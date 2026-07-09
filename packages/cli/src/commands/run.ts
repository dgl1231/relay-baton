import {
  ConfigLoader, SessionManager, GitService, BatonWorkflow,
  FallbackDetector, resolveFallbackPatterns, runAgent,
  HandoffQualityGate, TokenDietQualityGate, PromptBuilder, ContextCompressor,
  agentFallbackPatterns, isAgentId, UsageLedger,
  BoundedOrchestrator, GuardrailPolicy, ExecutionCheckpoints, HookRunner,
  WorkspaceManager, HandoffTriggerPolicy, suggestChain,
} from "@relay-baton/core";
import * as readline from "readline";
import * as fs from "fs";
import type { AgentId, DietProfileName } from "@relay-baton/shared";
import { ProjectOpts, resolveProjectContext } from "./projectOptions";
import { adapterFor } from "./agentFor";
import { auditApiKeyEnv } from "./auditApiKeyEnv";
import { ui, color } from "../ui";

export interface RunOpts extends ProjectOpts {
  diet?: string;
  force?: boolean;
  allowApiKeyEnv?: boolean;
  /** Override the first agent in the relay chain. */
  primary?: string;
  /** Override the second agent (single-fallback shorthand). */
  fallback?: string;
  /** Explicit N-way chain, comma-separated (e.g. "claude,codex,gemini"). */
  chain?: string;
  /** v2.5: bounded auto-orchestration — max extra continue-steps after the first pass. */
  until?: string;
  /** Pre-approve bounded continue steps (still capped + guardrail-gated). */
  yes?: boolean;
  /** v2.8 manual trigger: relay to the next agent after this hop even without a fallback signal. */
  handoffNow?: boolean;
}

/**
 * Confirmation prompt for a bounded continue step. Resolves true on y/yes.
 * v2.8 fix: when stdin is not a TTY (CI, piped input) there is nobody to
 * answer — auto-decline instead of hanging forever, and say so.
 */
function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    ui.warn(`no interactive terminal to confirm "${question.trim()}" — declining (pass --yes to pre-approve).`);
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^\s*y(es)?\s*$/i.test(answer));
    });
  });
}

/**
 * Deterministic "who's next" policy (v2.3): the relay chain is an ordered list
 * of agents. `--chain` wins; otherwise it is [primary, fallback] resolved from
 * flags > project overrides > config. Supports reverse (claude->codex) and
 * longer chains, not just codex->claude.
 */
export function resolveChain(
  opts: RunOpts,
  project: { primaryAgent?: AgentId; fallbackAgent?: AgentId } | undefined,
  config: { primaryAgent: AgentId; fallbackAgent: AgentId },
  assignedAgent?: AgentId,
): AgentId[] {
  let ids: string[];
  if (opts.chain) {
    ids = opts.chain.split(",").map(s => s.trim()).filter(Boolean);
  } else {
    // v2.6: a work item's assigned agent beats project/config defaults, but loses
    // to explicit --primary/--chain flags.
    const primary = opts.primary ?? assignedAgent ?? project?.primaryAgent ?? config.primaryAgent;
    const fallback = opts.fallback ?? project?.fallbackAgent ?? config.fallbackAgent;
    ids = fallback && fallback !== primary ? [primary, fallback] : [primary];
  }
  for (const id of ids) {
    if (!isAgentId(id)) {
      ui.fail(`unknown agent in relay chain: ${id}`);
      ui.hint(`known agents: codex, claude, opencode, gemini, aider, cursor`);
      process.exit(2);
    }
  }
  // Collapse immediate duplicates (a,a -> a); keep distinct relay hops.
  const chain: AgentId[] = [];
  for (const id of ids as AgentId[]) if (chain[chain.length - 1] !== id) chain.push(id);
  return chain;
}

export async function runCommand(task: string, opts: RunOpts) {
  const projectContext = resolveProjectContext(opts, true);
  const mainRoot = projectContext.repoRoot;
  // v2.6 item 3: if the active work item is backed by a git worktree, execute in
  // that isolated checkout (own working tree + own .ai-session) so parallel work
  // items never clobber each other's git state. The workspace registry stays in
  // the main repo.
  const activeItem = new WorkspaceManager(mainRoot).activeSession();
  const repoRoot = activeItem?.worktree && fs.existsSync(activeItem.worktree) ? activeItem.worktree : mainRoot;
  if (repoRoot !== mainRoot) ui.info(`session ${color.bold(activeItem!.name)} runs in its worktree: ${color.dim(repoRoot)}`);
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  if (!sm.getMeta()) sm.init(task);
  sm.writeTask(task);

  const git = new GitService(repoRoot);
  if (!git.isGitRepo()) {
    ui.fail(`${repoRoot} is not a git repository, so relay-baton can't track state here.`);
    ui.hint(`run ${color.bold("git init")} first, or point at a repo with --path <repoPath>.`);
    process.exit(2);
  }

  const profileName = (opts.diet ?? projectContext.project?.defaultDiet ?? config.tokenDiet.profile) as DietProfileName;
  if (!config.tokenDiet.profiles[profileName]) {
    ui.fail(`unknown diet profile: ${profileName}`);
    ui.hint(`valid profiles: off, lite, balanced, caveman, ultra`);
    process.exit(2);
  }

  // v2.6: honor the active work item's assigned agent as the default primary.
  const assignedAgent = activeItem?.assignedAgent;
  const chain = resolveChain(opts, projectContext.project, config, assignedAgent);
  ui.info(`relay chain: ${ui.chain(chain)}${assignedAgent && !opts.primary && !opts.chain ? color.dim(` (session "${activeItem!.name}" → ${assignedAgent})`) : ""}`);

  // v2.8 advisory routing hint — deterministic keyword match against registry
  // strength tags. Display only: never changes the resolved chain, and explicit
  // --chain/--primary suppress it entirely.
  if (!opts.chain && !opts.primary && chain.length > 1) {
    const hint = suggestChain(task, chain);
    if (hint.differs) {
      const why = Object.entries(hint.matched).map(([id, tags]) => `${id}: ${(tags as string[]).join("/")}`).join("; ");
      ui.info(`this task looks like a better fit for ${ui.chain(hint.chain)}${why ? color.dim(` — ${why}`) : ""}`);
      ui.hint(`just a suggestion — keeping your chain. Apply it with --chain ${hint.chain.join(",")}`);
    }
  }

  const startedAt = new Date().toISOString();
  sm.updateMeta({
    task,
    status: "running",
    primaryAgent: chain[0],
    fallbackAgent: chain[1] ?? chain[0],
    activeAgent: chain[0],
    tokenDietProfile: profileName,
    fallbackReason: null,
    startedAt,
    endedAt: undefined,
    durationMs: undefined,
  });

  const finalize = (status: "completed" | "failed", lastAgent: AgentId, lastError: string | null) => {
    const endedAt = new Date().toISOString();
    sm.updateMeta({
      status, lastAgent, activeAgent: "none", lastError,
      endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt),
    });
  };

  // v2.5 project hooks (opt-in, local-only). No-op when unconfigured.
  const hooks = new HookRunner(repoRoot, config);
  const runHooks = (phase: "preHandoff" | "postExecute") => {
    for (const r of hooks.run(phase, {
      allowApiKeyEnv: opts.allowApiKeyEnv,
      onStdout: l => process.stdout.write(l + "\n"),
      onStderr: l => process.stderr.write(l + "\n"),
    })) {
      if (!r.ok) ui.warn(`hook failed (${phase}): ${r.command} → ${r.exitCode ?? r.error}`);
    }
  };

  for (let hop = 0; hop < chain.length; hop++) {
    const agent = chain[hop];
    const isFirst = hop === 0;
    const nextAgent: AgentId | null = hop + 1 < chain.length ? chain[hop + 1] : null;
    const adapter = adapterFor(agent, config);

    // First hop runs the task fresh; later hops continue from the handoff. Pass
    // the continuation in both task+prompt so task- and prompt-oriented adapters
    // alike launch with the handoff framing.
    const continuation = PromptBuilder.continuation();
    const cmd = isFirst
      ? adapter.buildCommand({ task, repoRoot, sessionDir: sm.files.dir, dietProfile: profileName })
      : adapter.buildCommand({ task: continuation, prompt: continuation, repoRoot, sessionDir: sm.files.dir, dietProfile: profileName });

    // Only watch for fallback signals when there is a next agent to relay to.
    const detector = nextAgent
      ? new FallbackDetector(resolveFallbackPatterns(
          [...config.fallbackPatterns, ...agentFallbackPatterns(agent)],
          projectContext.project?.fallbackPatterns,
        ))
      : undefined;

    sm.updateMeta({ status: isFirst ? "running" : "running_fallback", activeAgent: agent });
    ui.heading(`${isFirst ? "Starting" : "Continuing"} with ${color.bold(agent)}  ${color.dim(`(hop ${hop + 1}/${chain.length})`)}`);
    ui.step(`${cmd.command} ${cmd.args.join(" ")}`);
    const r = await runAgent({
      command: cmd,
      logFile: sm.files.p("commandsLog"),
      authPolicy: config.authPolicy,
      allowApiKeyEnv: opts.allowApiKeyEnv,
      fallbackDetector: detector,
      onStdout: l => process.stdout.write(l + "\n"),
      onStderr: l => process.stderr.write(l + "\n"),
      onFallback: hit => ui.warn(`${agent} hit a limit — fallback pattern detected: "${hit.pattern}"`),
    });
    auditApiKeyEnv(repoRoot, r.passedThroughEnvVars, sm.getMeta()?.id);

    if (r.error) {
      ui.fail(`${agent} could not run: ${r.error}`);
      ui.hint(`check the agent is installed and logged in — try ${color.bold("relay-baton doctor")}`);
      finalize("failed", agent, r.error);
      process.exit(1);
    }

    // v2.8 broadened triggers: even on a clean exit, a manual --handoff-now or a
    // configured threshold can *suggest* relaying to the next agent. Manual flag
    // is explicit consent; thresholds are confirmation-first (or --yes).
    let relayReason: string | null = r.fallbackReason;
    if (relayReason === null && nextAgent !== null && r.exitCode === 0) {
      if (opts.handoffNow) {
        relayReason = "manual handoff (--handoff-now)";
        ui.info(`--handoff-now: passing the baton to ${color.bold(nextAgent)} without waiting for a fallback signal.`);
      } else {
        const report = new HandoffTriggerPolicy(repoRoot, config).evaluate();
        if (report.configured && report.triggered) {
          ui.warn(`handoff trigger threshold(s) reached:`);
          for (const hit of report.hits) ui.detail(hit.message);
          const ok = opts.yes || await confirm(`hand off to ${nextAgent} now? [y/N] `);
          if (ok) relayReason = `threshold trigger: ${report.hits.map(h => h.condition).join(", ")}`;
          else ui.info(`okay, staying with ${agent} — finishing without a handoff.`);
        }
      }
    }

    const wantsFallback = relayReason !== null && nextAgent !== null;
    if (!wantsFallback) {
      // Terminal: either finished cleanly, or hit a limit with no one left to relay to.
      if (r.fallbackReason !== null) {
        sm.updateMeta({ fallbackReason: r.fallbackReason });
        ui.warn(`${agent} hit a limit, but there is no one left in the chain to hand off to.`);
        ui.hint(`add a fallback agent with --fallback <agent> or a longer --chain next time.`);
      }
      // v2.5: bounded auto-orchestration. Only when the agent finished cleanly
      // and --until is set. Strictly capped, guardrail-gated, confirmation-first.
      if (r.exitCode === 0 && r.fallbackReason === null && opts.until) {
        await runUntilLoop(agent, { repoRoot, sm, config, profileName, opts, startedAt, finalize, runHooks });
        return;
      }
      if (r.exitCode === 0) runHooks("postExecute");
      finalize(r.exitCode === 0 ? "completed" : "failed", agent, r.exitCode === 0 ? null : `${agent} exited with ${r.exitCode}`);
      if (r.exitCode === 0) {
        ui.ok(`${color.bold(agent)} finished the task.`);
        ui.hint(`see what changed: ${color.bold("relay-baton review")} · session state: ${color.bold("relay-baton status")}`);
      } else {
        ui.fail(`${agent} exited with code ${r.exitCode}.`);
        ui.hint(`the full log is in .ai-session/commands.log — ${color.bold("relay-baton status")} shows the session state.`);
      }
      return;
    }

    // Relay to the next agent: record fallback, (optionally) compress, build+gate handoff.
    sm.updateMeta({ lastAgent: agent, activeAgent: "none", fallbackReason: relayReason, status: "fallback_detected", lastError: null });

    if (config.contextCompression?.enabled && config.contextCompression?.auto) {
      const cc = new ContextCompressor(repoRoot, config);
      const res = cc.compressIfNeeded(config.tokenDiet.profiles[profileName], {});
      if (res.compressed) {
        sm.updateMeta({ status: "compressing" });
        ui.info(`context compressed: ${res.before.total} → ${res.after?.total} chars`);
        sm.updateMeta({ status: "fallback_detected" });
      }
    }

    runHooks("preHandoff");
    ui.step(`building a compact handoff for ${color.bold(nextAgent!)}…`);
    const wf = new BatonWorkflow(sm, config);
    const h = wf.buildHandoff({ profileName, fallbackReason: relayReason!, previousAgent: agent, nextAgent: nextAgent! });
    sm.updateMeta({ handoffCount: (sm.getMeta()?.handoffCount ?? 0) + 1 });
    // v2.4 local usage insight (token proxy; never transmitted).
    new UsageLedger(repoRoot).record("handoff", nextAgent!, h.usedChars, `${agent}→${nextAgent}`);

    const gate = new HandoffQualityGate(repoRoot).check();
    const dietGate = new TokenDietQualityGate(repoRoot, profileName, config.tokenDiet.profiles[profileName]).check({ wasTruncated: h.truncated });
    let blocked = false;
    if (!gate.ok) { ui.fail("Handoff Quality Gate failed:"); for (const f of gate.failures) ui.detail(f); blocked = true; }
    if (!dietGate.ok) { ui.fail("Token Diet Quality Gate failed:"); for (const f of dietGate.failures) ui.detail(f); blocked = true; }
    for (const w of dietGate.warnings) ui.warn(w);
    const highFindings = h.redaction.findings.filter(f => f.severity === "high");
    if (highFindings.length > 0) {
      ui.fail("Redaction Gate failed — the handoff would leak secrets to the next agent:");
      for (const f of highFindings) ui.detail(`${f.category}: ${f.file}${f.line ? ":" + f.line : ""} (${f.hint})`);
      blocked = true;
    }
    for (const f of h.redaction.findings.filter(f => f.severity !== "high")) {
      ui.warn(`redaction ${f.category} in ${f.file}${f.line ? ":" + f.line : ""} (${f.hint})`);
    }
    if (blocked && !opts.force) {
      ui.fail(`stopping before the ${nextAgent} launch — the handoff didn't pass the gates above.`);
      ui.hint(`fix the findings (safest), or re-run with --force if you're sure.`);
      process.exit(3);
    }
    if (!blocked) ui.ok(`handoff ready — passing the baton: ${ui.chain(chain, hop + 1)}`);
    // loop continues to nextAgent
  }
}

interface UntilCtx {
  repoRoot: string;
  sm: any;
  config: any;
  profileName: DietProfileName;
  opts: RunOpts;
  startedAt: string;
  finalize: (status: "completed" | "failed", lastAgent: AgentId, lastError: string | null) => void;
  runHooks: (phase: "preHandoff" | "postExecute") => void;
}

/**
 * v2.5 bounded auto-orchestration. STRICTLY bounded: capped by --until (and the
 * guardrail step cap), gated by GuardrailPolicy each step, and confirmation-first
 * unless --yes. Never a daemon, never unattended without explicit pre-approval.
 */
async function runUntilLoop(agent: AgentId, ctx: UntilCtx) {
  const { repoRoot, sm, config, profileName, opts, startedAt, finalize, runHooks } = ctx;
  const maxSteps = Math.max(1, Math.floor(Number(opts.until)) || 0);
  if (maxSteps < 1) { finalize("completed", agent, null); return; }

  const budgetCeiling = config.guardrails?.maxBudgetRatio ?? 0.9;
  const orch = new BoundedOrchestrator({
    maxSteps,
    budgetCeiling,
    evaluateGuardrail: () => new GuardrailPolicy(repoRoot, config).evaluate(),
  });
  const checkpoints = new ExecutionCheckpoints(repoRoot, config);
  const ledger = new UsageLedger(repoRoot);
  const adapter = adapterFor(agent, config);

  ui.info(`bounded auto-orchestration: up to ${maxSteps} extra step(s) on ${color.bold(agent)} ${color.dim(`(guardrail-gated${opts.yes ? "" : ", confirm each"})`)}`);

  let obs: { budgetRatio?: number; progressKey?: string } = {};
  for (;;) {
    const d = orch.next(obs);
    if (!d.proceed) {
      ui.info(`bounded loop stopped: ${d.reason ?? "done"}`);
      if (d.guardrail?.blocked) for (const v of d.guardrail.violations) ui.detail(v.message);
      break;
    }
    if (d.requireConfirmation && !opts.yes) {
      const ok = await confirm(`[relay-baton] continue step ${d.step}/${maxSteps} on ${agent}? [y/N] `);
      if (!ok) { ui.info("okay — stopping the bounded loop here."); break; }
    }

    sm.updateMeta({ status: "running", activeAgent: agent });
    const continuation = PromptBuilder.continuation();
    const cmd = adapter.buildCommand({ task: continuation, prompt: continuation, repoRoot, sessionDir: sm.files.dir, dietProfile: profileName });
    ui.step(`[until ${d.step}/${maxSteps}] ${cmd.command} ${cmd.args.join(" ")}`);
    const r = await runAgent({
      command: cmd,
      logFile: sm.files.p("commandsLog"),
      authPolicy: config.authPolicy,
      allowApiKeyEnv: opts.allowApiKeyEnv,
      onStdout: (l: string) => process.stdout.write(l + "\n"),
      onStderr: (l: string) => process.stderr.write(l + "\n"),
    });
    auditApiKeyEnv(repoRoot, r.passedThroughEnvVars, sm.getMeta()?.id);
    if (r.error || r.exitCode !== 0) {
      finalize("failed", agent, r.error ?? `${agent} exited with ${r.exitCode}`);
      ui.fail(`bounded step failed; stopping.`);
      process.exit(1);
    }

    checkpoints.append({ step: d.step, command: `run --until step ${d.step}`, result: "ok" });
    const handoffChars = (() => { try { return require("fs").statSync(sm.files.p("handoff")).size; } catch { return 0; } })();
    ledger.record("run", agent, handoffChars, `until ${d.step}/${maxSteps}`);

    const summary = new GitService(repoRoot).summary(0);
    obs = { budgetRatio: undefined, progressKey: `${summary.head}:${summary.changed}` };
  }

  runHooks("postExecute");
  finalize("completed", agent, null);
  ui.ok(`${color.bold(agent)} finished the bounded loop.`);
}
