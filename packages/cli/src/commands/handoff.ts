import * as fs from "fs";
import {
  ConfigLoader, SessionManager, BatonWorkflow,
  HandoffQualityGate, TokenDietQualityGate,
  ClaudeCodeAdapter, PromptBuilder, runAgent, GitService,
  UsageLedger, isAgentId, HookRunner,
} from "@relay-baton/core";
import type { DietProfileName } from "@relay-baton/shared";
import { ProjectOpts, resolveProjectContext } from "./projectOptions";
import { auditApiKeyEnv } from "./auditApiKeyEnv";
import { ui, color } from "../ui";
import { agentStreamIO } from "../agentStream";

export interface HandoffOpts extends ProjectOpts {
  to: string;
  diet?: string;
  force?: boolean;
  run?: boolean;
  noRun?: boolean;
  allowApiKeyEnv?: boolean;
  /** Friendly rendering of the agent's structured output stream (codex/claude). */
  pretty?: boolean;
}

export async function handoffCommand(opts: HandoffOpts) {
  const projectContext = resolveProjectContext(opts, true);
  const repoRoot = projectContext.repoRoot;
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  if (!sm.getMeta()) sm.init("");

  const git = new GitService(repoRoot);
  if (!git.isGitRepo()) {
    ui.fail("not a git repository — a handoff needs repo state.");
    ui.hint("run `git init` first, or point at a repo with --path <repoPath>.");
    process.exit(2);
  }

  const profileName = (opts.diet ?? sm.getMeta()?.tokenDietProfile ?? projectContext.project?.defaultDiet ?? config.tokenDiet.profile) as DietProfileName;
  if (!config.tokenDiet.profiles[profileName]) {
    ui.fail(`unknown diet profile: ${profileName}`);
    ui.hint("valid profiles: off, lite, balanced, caveman, ultra");
    process.exit(2);
  }

  // v0.4 observability: stamp the start of this handoff and clear any stale
  // endedAt/durationMs from a previous run/handoff in the same session.
  const startedAt = new Date().toISOString();
  sm.updateMeta({ startedAt, endedAt: undefined, durationMs: undefined });

  const prevMeta = sm.getMeta()!;
  // v2.5 pre-handoff hooks (opt-in, local-only; no-op when unconfigured).
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
  runHooks("preHandoff");
  const wf = new BatonWorkflow(sm, config);
  const result = wf.buildHandoff({
    profileName,
    fallbackReason: prevMeta.fallbackReason,
    previousAgent: prevMeta.lastAgent !== "none" ? prevMeta.lastAgent : "codex",
    nextAgent: opts.to,
  });

  // v0.4 observability: count this successful handoff write.
  const prevCount = sm.getMeta()?.handoffCount ?? 0;
  sm.updateMeta({
    status: "handoff_ready",
    tokenDietProfile: profileName,
    handoffCount: prevCount + 1,
  });
  ui.ok(`handoff written: ${color.dim(result.handoffPath)} ${color.dim(`(${result.usedChars} chars, truncated=${result.truncated})`)}`);
  // v2.4 local usage insight (token proxy; never transmitted).
  new UsageLedger(repoRoot).record("handoff", isAgentId(opts.to) ? opts.to : "none", result.usedChars, `${prevMeta.lastAgent}→${opts.to}`);

  const gate = new HandoffQualityGate(repoRoot).check();
  const dietGate = new TokenDietQualityGate(repoRoot, profileName, config.tokenDiet.profiles[profileName])
    .check({ wasTruncated: result.truncated });

  let blocked = false;
  if (!gate.ok) {
    ui.fail("Handoff Quality Gate failed:");
    for (const f of gate.failures) ui.detail(f);
    blocked = true;
  }
  if (!dietGate.ok) {
    ui.fail("Token Diet Quality Gate failed:");
    for (const f of dietGate.failures) ui.detail(f);
    blocked = true;
  }
  for (const w of dietGate.warnings) ui.warn(w);

  // Redaction gate: never let high-severity secrets reach the next agent.
  // Medium findings (home paths, oversized) are warnings only.
  const redaction = result.redaction;
  const highFindings = redaction.findings.filter(f => f.severity === "high");
  if (highFindings.length > 0) {
    ui.fail("Redaction Gate failed — the handoff would leak secrets to the next agent:");
    for (const f of highFindings) ui.detail(`${f.category}: ${f.file}${f.line ? ":" + f.line : ""} (${f.hint})`);
    blocked = true;
  }
  for (const f of redaction.findings.filter(f => f.severity !== "high")) {
    ui.warn(`redaction ${f.category} in ${f.file}${f.line ? ":" + f.line : ""} (${f.hint})`);
  }

  if (blocked && !opts.force) {
    console.error("[relay-baton] aborting. Use --force to override.");
    process.exit(3);
  }
  if (opts.run === false || opts.noRun) return;
  if (opts.to !== "claude") {
    console.error("[relay-baton] MVP only supports --to claude");
    process.exit(2);
  }

  const adapter = new ClaudeCodeAdapter(config.agents.claude);
  const prompt = PromptBuilder.claudeContinuation();
  const { structured, io } = agentStreamIO(adapter, opts.pretty);
  const cmd = adapter.buildCommand({ task: prevMeta.task, repoRoot, sessionDir: sm.files.dir, prompt, structuredStream: structured });
  sm.updateMeta({ activeAgent: "claude", status: "running_fallback" });
  const r = await runAgent({
    command: cmd,
    logFile: sm.files.p("commandsLog"),
    authPolicy: config.authPolicy,
    allowApiKeyEnv: opts.allowApiKeyEnv,
    ...io,
  });
  auditApiKeyEnv(repoRoot, r.passedThroughEnvVars, sm.getMeta()?.id);
  if (r.error) {
    console.error(r.error);
    const endedAt = new Date().toISOString();
    sm.updateMeta({
      status: "failed", lastError: r.error, lastAgent: "claude", activeAgent: "none",
      endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt),
    });
    process.exit(1);
  }
  if (r.exitCode === 0) runHooks("postExecute");
  const endedAt = new Date().toISOString();
  sm.updateMeta({
    status: r.exitCode === 0 ? "completed" : "failed",
    lastAgent: "claude",
    activeAgent: "none",
    lastError: r.exitCode === 0 ? null : `claude exited with ${r.exitCode}`,
    endedAt,
    durationMs: Date.parse(endedAt) - Date.parse(startedAt),
  });
}
