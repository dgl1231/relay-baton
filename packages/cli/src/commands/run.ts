import {
  ConfigLoader, SessionManager, GitService, BatonWorkflow,
  CodexAdapter, ClaudeCodeAdapter, FallbackDetector, resolveFallbackPatterns, runAgent,
  HandoffQualityGate, TokenDietQualityGate, PromptBuilder, ContextCompressor,
} from "@relay-baton/core";
import type { DietProfileName } from "@relay-baton/shared";
import { ProjectOpts, resolveProjectContext } from "./projectOptions";

export interface RunOpts extends ProjectOpts {
  diet?: string;
  force?: boolean;
  allowApiKeyEnv?: boolean;
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

  // v0.4 observability: stamp the start of this run; clear any stale
  // endedAt/durationMs from a previous run/handoff in the same session.
  const startedAt = new Date().toISOString();
  sm.updateMeta({
    task,
    status: "running",
    activeAgent: "codex",
    tokenDietProfile: profileName,
    fallbackReason: null,
    startedAt,
    endedAt: undefined,
    durationMs: undefined,
  });

  const codex = new CodexAdapter(config.agents.codex);
  const cmd = codex.buildCommand({ task, repoRoot, sessionDir: sm.files.dir, dietProfile: profileName });
  const patterns = resolveFallbackPatterns(config.fallbackPatterns, projectContext.project?.fallbackPatterns);
  const detector = new FallbackDetector(patterns);

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

  if (r.error) {
    console.error(r.error);
    const endedAt = new Date().toISOString();
    sm.updateMeta({
      status: "failed", lastError: r.error, lastAgent: "codex", activeAgent: "none",
      endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt),
    });
    process.exit(1);
  }

  const shouldFallback = r.fallbackReason !== null;
  if (shouldFallback) {
    // Not terminal yet — fallback flow continues below; don't stamp endedAt.
    sm.updateMeta({
      lastAgent: "codex",
      activeAgent: "none",
      fallbackReason: r.fallbackReason,
      status: "fallback_detected",
      lastError: null,
    });
  } else {
    // Terminal — Codex finished, no fallback needed. Stamp endedAt/duration.
    const endedAt = new Date().toISOString();
    sm.updateMeta({
      lastAgent: "codex",
      activeAgent: "none",
      fallbackReason: r.fallbackReason,
      status: r.exitCode === 0 ? "completed" : "failed",
      lastError: r.exitCode === 0 ? null : `codex exited with ${r.exitCode}`,
      endedAt,
      durationMs: Date.parse(endedAt) - Date.parse(startedAt),
    });
    console.log("[relay-baton] codex finished without fallback. exiting.");
    return;
  }

  // v0.5 context compression: before building the handoff, proactively
  // compress running context so the handoff is assembled from tighter
  // state.md / commands.log. Auto-only and threshold-gated; rolls back itself
  // on its own gate failure (so it can never make the handoff worse).
  if (config.contextCompression?.enabled && config.contextCompression?.auto) {
    const cc = new ContextCompressor(repoRoot, config);
    const profile = config.tokenDiet.profiles[profileName];
    const res = cc.compressIfNeeded(profile, {});
    if (res.compressed) {
      sm.updateMeta({ status: "compressing" });
      console.log(`[relay-baton] context compressed: ${res.before.total} -> ${res.after?.total} chars`);
      sm.updateMeta({ status: "fallback_detected" });
    }
  }

  console.log("[relay-baton] building handoff for claude...");
  const wf = new BatonWorkflow(sm, config);
  const h = wf.buildHandoff({
    profileName,
    fallbackReason: r.fallbackReason,
    previousAgent: "codex",
    nextAgent: "claude",
  });
  // v0.4 observability: count this successful handoff write.
  const prevCount = sm.getMeta()?.handoffCount ?? 0;
  sm.updateMeta({ handoffCount: prevCount + 1 });

  const gate = new HandoffQualityGate(repoRoot).check();
  const dietGate = new TokenDietQualityGate(repoRoot, profileName, config.tokenDiet.profiles[profileName])
    .check({ wasTruncated: h.truncated });

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

  sm.updateMeta({ status: "running_fallback", activeAgent: "claude" });
  const claude = new ClaudeCodeAdapter(config.agents.claude);
  const ccmd = claude.buildCommand({ task, repoRoot, sessionDir: sm.files.dir, prompt: PromptBuilder.claudeContinuation() });
  const r2 = await runAgent({
    command: ccmd,
    logFile: sm.files.p("commandsLog"),
    authPolicy: config.authPolicy,
    allowApiKeyEnv: opts.allowApiKeyEnv,
    onStdout: l => process.stdout.write(l + "\n"),
    onStderr: l => process.stderr.write(l + "\n"),
  });

  if (r2.error) {
    console.error(r2.error);
    const endedAt = new Date().toISOString();
    sm.updateMeta({
      status: "failed", lastError: r2.error, lastAgent: "claude", activeAgent: "none",
      endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt),
    });
    process.exit(1);
  }
  const endedAt = new Date().toISOString();
  sm.updateMeta({
    status: r2.exitCode === 0 ? "completed" : "failed",
    lastAgent: "claude",
    activeAgent: "none",
    lastError: r2.exitCode === 0 ? null : `claude exited with ${r2.exitCode}`,
    endedAt,
    durationMs: Date.parse(endedAt) - Date.parse(startedAt),
  });
}
