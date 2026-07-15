import * as fs from "fs";
import {
  ConfigLoader, SessionManager, BatonWorkflow, GitService,
  PlanQualityGate, PromptBuilder, runAgent, FallbackDetector,
  HandoffQualityGate, TokenDietQualityGate,
} from "@relay-baton/core";
import type { AgentId, DietProfileName } from "@relay-baton/shared";
import { ProjectOpts, resolveProjectContext } from "./projectOptions";
import { adapterFor } from "./agentFor";
import { agentStreamIO } from "../agentStream";

export interface ExecuteOpts extends ProjectOpts {
  diet?: string;
  with?: string;
  from?: string;
  force?: boolean;
  allowApiKeyEnv?: boolean;
  /** Friendly rendering of the agent's structured output stream (codex/claude). */
  pretty?: boolean;
}

export async function executeCommand(opts: ExecuteOpts) {
  const projectContext = resolveProjectContext(opts, true);
  const repoRoot = projectContext.repoRoot;
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  if (!sm.getMeta()) sm.init("");

  const git = new GitService(repoRoot);
  if (!git.isGitRepo()) {
    console.error("[relay-baton] not a git repository. aborting.");
    process.exit(2);
  }

  const meta = sm.getMeta()!;
  const profileName = (opts.diet ?? meta.tokenDietProfile ?? projectContext.project?.defaultDiet ?? config.tokenDiet.profile) as DietProfileName;
  if (!config.tokenDiet.profiles[profileName]) {
    console.error(`unknown diet profile: ${profileName}`);
    process.exit(2);
  }

  // A plan must exist.
  const planPath = opts.from ?? sm.files.p("plan");
  if (!fs.existsSync(planPath)) {
    console.error(`[relay-baton] no plan found at ${planPath}. Run 'relay-baton plan "<task>"' first.`);
    process.exit(2);
  }
  // If reading from a custom path, copy it into the session so the gate + agent see it.
  if (opts.from && opts.from !== sm.files.p("plan")) {
    fs.copyFileSync(opts.from, sm.files.p("plan"));
  }

  // Gate the plan before executing.
  const planGate = new PlanQualityGate(repoRoot, config.tokenDiet.profiles[profileName]).check();
  if (!planGate.ok) {
    console.error("[relay-baton] Plan Quality Gate failed:");
    for (const f of planGate.failures) console.error("  - " + f);
    if (!opts.force) {
      console.error("[relay-baton] aborting. Fix plan.md or use --force.");
      process.exit(3);
    }
  }

  const executor = (opts.with ?? config.planExecute?.defaultExecutor ?? "codex") as AgentId;

  const startedAt = new Date().toISOString();
  sm.updateMeta({
    workflowMode: "plan-execute",
    executor,
    status: "executing",
    activeAgent: executor,
    executeStartedAt: startedAt,
    startedAt,
    endedAt: undefined,
    durationMs: undefined,
    fallbackReason: null,
  });

  const adapter = adapterFor(executor, config);
  const prompt = PromptBuilder.executor();
  const { structured, io } = agentStreamIO(adapter, opts.pretty);
  const cmd = adapter.buildCommand({ task: prompt, prompt, repoRoot, sessionDir: sm.files.dir, dietProfile: profileName, structuredStream: structured });
  const detector = new FallbackDetector(config.fallbackPatterns);

  console.log(`[relay-baton] executing plan with ${cmd.command} (${executor}) ...`);
  const r = await runAgent({
    command: cmd,
    logFile: sm.files.p("commandsLog"),
    authPolicy: config.authPolicy,
    allowApiKeyEnv: opts.allowApiKeyEnv,
    fallbackDetector: detector,
    ...io,
    onFallback: hit => console.error(`[relay-baton] fallback pattern detected: ${hit.pattern}`),
  });

  const finish = (status: "completed" | "failed", lastError: string | null, lastAgent: AgentId) => {
    const endedAt = new Date().toISOString();
    sm.updateMeta({
      status, lastError, lastAgent, activeAgent: "none",
      endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt),
    });
  };

  if (r.error) {
    console.error(r.error);
    finish("failed", r.error, executor);
    process.exit(1);
  }

  const shouldFallback = r.fallbackReason !== null;
  if (!shouldFallback) {
    finish(r.exitCode === 0 ? "completed" : "failed",
      r.exitCode === 0 ? null : `${executor} exited with ${r.exitCode}`, executor);
    console.log("[relay-baton] execute finished without fallback.");
    return;
  }

  // In-execute fallback: build a handoff and hand to the fallback agent,
  // reusing the v0.4 quality gates (composition with fallback mode).
  console.log("[relay-baton] building handoff for fallback agent...");
  sm.updateMeta({ status: "fallback_detected", fallbackReason: r.fallbackReason, lastAgent: executor, activeAgent: "none" });
  const wf = new BatonWorkflow(sm, config);
  const h = wf.buildHandoff({
    profileName,
    fallbackReason: r.fallbackReason,
    previousAgent: executor,
    nextAgent: config.fallbackAgent,
  });
  const prevCount = sm.getMeta()?.handoffCount ?? 0;
  sm.updateMeta({ handoffCount: prevCount + 1 });

  const gate = new HandoffQualityGate(repoRoot).check();
  const dietGate = new TokenDietQualityGate(repoRoot, profileName, config.tokenDiet.profiles[profileName])
    .check({ wasTruncated: h.truncated });
  let blocked = false;
  if (!gate.ok) { console.error("Handoff Quality Gate failed:"); for (const f of gate.failures) console.error("  - " + f); blocked = true; }
  if (!dietGate.ok) { console.error("Token Diet Quality Gate failed:"); for (const f of dietGate.failures) console.error("  - " + f); blocked = true; }
  for (const w of dietGate.warnings) console.error("warn: " + w);
  if (blocked && !opts.force) {
    console.error("[relay-baton] aborting fallback launch. Use --force to override.");
    process.exit(3);
  }

  const fb = config.fallbackAgent;
  sm.updateMeta({ status: "running_fallback", activeAgent: fb });
  const fbAdapter = adapterFor(fb, config);
  const fbStream = agentStreamIO(fbAdapter, opts.pretty);
  const fbCmd = fbAdapter.buildCommand({
    task: PromptBuilder.claudeContinuation(),
    prompt: PromptBuilder.claudeContinuation(),
    repoRoot, sessionDir: sm.files.dir,
    structuredStream: fbStream.structured,
  });
  const r2 = await runAgent({
    command: fbCmd,
    logFile: sm.files.p("commandsLog"),
    authPolicy: config.authPolicy,
    allowApiKeyEnv: opts.allowApiKeyEnv,
    ...fbStream.io,
  });
  if (r2.error) {
    console.error(r2.error);
    finish("failed", r2.error, fb);
    process.exit(1);
  }
  finish(r2.exitCode === 0 ? "completed" : "failed",
    r2.exitCode === 0 ? null : `${fb} exited with ${r2.exitCode}`, fb);
}
