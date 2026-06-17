import {
  ConfigLoader, SessionManager, GitService, BatonWorkflow,
  FallbackDetector, resolveFallbackPatterns, runAgent,
  HandoffQualityGate, TokenDietQualityGate, PromptBuilder, ContextCompressor,
  agentFallbackPatterns, isAgentId, UsageLedger,
  BoundedOrchestrator, GuardrailPolicy, ExecutionCheckpoints, HookRunner,
  WorkspaceManager,
} from "@relay-baton/core";
import * as readline from "readline";
import type { AgentId, DietProfileName } from "@relay-baton/shared";
import { ProjectOpts, resolveProjectContext } from "./projectOptions";
import { adapterFor } from "./agentFor";
import { auditApiKeyEnv } from "./auditApiKeyEnv";

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
}

/** Confirmation prompt for a bounded continue step. Resolves true on y/yes. */
function confirm(question: string): Promise<boolean> {
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
      console.error(`[relay-baton] unknown agent in relay chain: ${id}`);
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
  const repoRoot = projectContext.repoRoot;
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  if (!sm.getMeta()) sm.init(task);
  sm.writeTask(task);

  const git = new GitService(repoRoot);
  if (!git.isGitRepo()) {
    console.error("[relay-baton] not a git repository. aborting.");
    process.exit(2);
  }

  const profileName = (opts.diet ?? projectContext.project?.defaultDiet ?? config.tokenDiet.profile) as DietProfileName;
  if (!config.tokenDiet.profiles[profileName]) {
    console.error(`unknown diet profile: ${profileName}`);
    process.exit(2);
  }

  // v2.6: honor the active work item's assigned agent as the default primary.
  const ws = new WorkspaceManager(repoRoot).load();
  const assignedAgent = ws.sessions.find(s => s.name === ws.active)?.assignedAgent;
  const chain = resolveChain(opts, projectContext.project, config, assignedAgent);
  console.log(`[relay-baton] relay chain: ${chain.join(" → ")}${assignedAgent && !opts.primary && !opts.chain ? ` (session "${ws.active}" → ${assignedAgent})` : ""}`);

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
      if (!r.ok) console.error(`[relay-baton] hook failed (${phase}): ${r.command} → ${r.exitCode ?? r.error}`);
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
    console.log(`[relay-baton] running ${cmd.command} ${cmd.args.join(" ")}`);
    const r = await runAgent({
      command: cmd,
      logFile: sm.files.p("commandsLog"),
      authPolicy: config.authPolicy,
      allowApiKeyEnv: opts.allowApiKeyEnv,
      fallbackDetector: detector,
      onStdout: l => process.stdout.write(l + "\n"),
      onStderr: l => process.stderr.write(l + "\n"),
      onFallback: hit => console.error(`[relay-baton] fallback pattern detected: ${hit.pattern}`),
    });
    auditApiKeyEnv(repoRoot, r.passedThroughEnvVars, sm.getMeta()?.id);

    if (r.error) {
      console.error(r.error);
      finalize("failed", agent, r.error);
      process.exit(1);
    }

    const wantsFallback = r.fallbackReason !== null && nextAgent !== null;
    if (!wantsFallback) {
      // Terminal: either finished cleanly, or hit a limit with no one left to relay to.
      if (r.fallbackReason !== null) {
        sm.updateMeta({ fallbackReason: r.fallbackReason });
        console.log(`[relay-baton] ${agent} hit a fallback signal but the relay chain is exhausted.`);
      }
      // v2.5: bounded auto-orchestration. Only when the agent finished cleanly
      // and --until is set. Strictly capped, guardrail-gated, confirmation-first.
      if (r.exitCode === 0 && r.fallbackReason === null && opts.until) {
        await runUntilLoop(agent, { repoRoot, sm, config, profileName, opts, startedAt, finalize, runHooks });
        return;
      }
      if (r.exitCode === 0) runHooks("postExecute");
      finalize(r.exitCode === 0 ? "completed" : "failed", agent, r.exitCode === 0 ? null : `${agent} exited with ${r.exitCode}`);
      console.log(`[relay-baton] ${agent} finished. exiting.`);
      return;
    }

    // Relay to the next agent: record fallback, (optionally) compress, build+gate handoff.
    sm.updateMeta({ lastAgent: agent, activeAgent: "none", fallbackReason: r.fallbackReason, status: "fallback_detected", lastError: null });

    if (config.contextCompression?.enabled && config.contextCompression?.auto) {
      const cc = new ContextCompressor(repoRoot, config);
      const res = cc.compressIfNeeded(config.tokenDiet.profiles[profileName], {});
      if (res.compressed) {
        sm.updateMeta({ status: "compressing" });
        console.log(`[relay-baton] context compressed: ${res.before.total} -> ${res.after?.total} chars`);
        sm.updateMeta({ status: "fallback_detected" });
      }
    }

    runHooks("preHandoff");
    console.log(`[relay-baton] building handoff for ${nextAgent}...`);
    const wf = new BatonWorkflow(sm, config);
    const h = wf.buildHandoff({ profileName, fallbackReason: r.fallbackReason, previousAgent: agent, nextAgent: nextAgent! });
    sm.updateMeta({ handoffCount: (sm.getMeta()?.handoffCount ?? 0) + 1 });
    // v2.4 local usage insight (token proxy; never transmitted).
    new UsageLedger(repoRoot).record("handoff", nextAgent!, h.usedChars, `${agent}→${nextAgent}`);

    const gate = new HandoffQualityGate(repoRoot).check();
    const dietGate = new TokenDietQualityGate(repoRoot, profileName, config.tokenDiet.profiles[profileName]).check({ wasTruncated: h.truncated });
    let blocked = false;
    if (!gate.ok) { console.error("Handoff Quality Gate failed:"); for (const f of gate.failures) console.error("  - " + f); blocked = true; }
    if (!dietGate.ok) { console.error("Token Diet Quality Gate failed:"); for (const f of dietGate.failures) console.error("  - " + f); blocked = true; }
    for (const w of dietGate.warnings) console.error("warn: " + w);
    const highFindings = h.redaction.findings.filter(f => f.severity === "high");
    if (highFindings.length > 0) {
      console.error("Redaction Gate failed (handoff would leak secrets to the next agent):");
      for (const f of highFindings) console.error(`  - ${f.category}: ${f.file}${f.line ? ":" + f.line : ""} (${f.hint})`);
      blocked = true;
    }
    for (const f of h.redaction.findings.filter(f => f.severity !== "high")) {
      console.error(`warn: redaction ${f.category} in ${f.file}${f.line ? ":" + f.line : ""} (${f.hint})`);
    }
    if (blocked && !opts.force) {
      console.error("[relay-baton] aborting fallback launch. Use --force to override.");
      process.exit(3);
    }
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

  console.log(`[relay-baton] bounded auto-orchestration: up to ${maxSteps} extra step(s) on ${agent} (guardrail-gated${opts.yes ? "" : ", confirm each"})`);

  let obs: { budgetRatio?: number; progressKey?: string } = {};
  for (;;) {
    const d = orch.next(obs);
    if (!d.proceed) {
      console.log(`[relay-baton] bounded loop stopped: ${d.reason ?? "done"}`);
      if (d.guardrail?.blocked) for (const v of d.guardrail.violations) console.log(`  - ${v.message}`);
      break;
    }
    if (d.requireConfirmation && !opts.yes) {
      const ok = await confirm(`[relay-baton] continue step ${d.step}/${maxSteps} on ${agent}? [y/N] `);
      if (!ok) { console.log("[relay-baton] declined — stopping bounded loop."); break; }
    }

    sm.updateMeta({ status: "running", activeAgent: agent });
    const continuation = PromptBuilder.continuation();
    const cmd = adapter.buildCommand({ task: continuation, prompt: continuation, repoRoot, sessionDir: sm.files.dir, dietProfile: profileName });
    console.log(`[relay-baton] [until ${d.step}/${maxSteps}] running ${cmd.command} ${cmd.args.join(" ")}`);
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
      console.error(`[relay-baton] bounded step failed; stopping.`);
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
  console.log(`[relay-baton] ${agent} bounded loop finished. exiting.`);
}
