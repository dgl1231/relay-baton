import * as fs from "fs";
import {
  ConfigLoader, SessionManager, BatonWorkflow,
  HandoffQualityGate, TokenDietQualityGate,
  ClaudeCodeAdapter, PromptBuilder, runAgent, GitService,
} from "@relay-baton/core";
import type { DietProfileName } from "@relay-baton/shared";
import { ProjectOpts, resolveProjectContext } from "./projectOptions";

export interface HandoffOpts extends ProjectOpts {
  to: string;
  diet?: string;
  force?: boolean;
  run?: boolean;
  noRun?: boolean;
  allowApiKeyEnv?: boolean;
}

export async function handoffCommand(opts: HandoffOpts) {
  const projectContext = resolveProjectContext(opts, true);
  const repoRoot = projectContext.repoRoot;
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  if (!sm.getMeta()) sm.init("");

  const git = new GitService(repoRoot);
  if (!git.isGitRepo()) {
    console.error("[relay-baton] not a git repository. aborting handoff.");
    process.exit(2);
  }

  const profileName = (opts.diet ?? sm.getMeta()?.tokenDietProfile ?? projectContext.project?.defaultDiet ?? config.tokenDiet.profile) as DietProfileName;
  if (!config.tokenDiet.profiles[profileName]) {
    console.error(`unknown diet profile: ${profileName}`);
    process.exit(2);
  }

  // v0.4 observability: stamp the start of this handoff and clear any stale
  // endedAt/durationMs from a previous run/handoff in the same session.
  const startedAt = new Date().toISOString();
  sm.updateMeta({ startedAt, endedAt: undefined, durationMs: undefined });

  const prevMeta = sm.getMeta()!;
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
  console.log(`[relay-baton] handoff written: ${result.handoffPath} (${result.usedChars} chars, truncated=${result.truncated})`);

  const gate = new HandoffQualityGate(repoRoot).check();
  const dietGate = new TokenDietQualityGate(repoRoot, profileName, config.tokenDiet.profiles[profileName])
    .check({ wasTruncated: result.truncated });

  let blocked = false;
  if (!gate.ok) {
    console.error("[relay-baton] Handoff Quality Gate failed:");
    for (const f of gate.failures) console.error("  - " + f);
    blocked = true;
  }
  if (!dietGate.ok) {
    console.error("[relay-baton] Token Diet Quality Gate failed:");
    for (const f of dietGate.failures) console.error("  - " + f);
    blocked = true;
  }
  for (const w of dietGate.warnings) console.error("[relay-baton] warn: " + w);

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
  const cmd = adapter.buildCommand({ task: prevMeta.task, repoRoot, sessionDir: sm.files.dir, prompt });
  sm.updateMeta({ activeAgent: "claude", status: "running_fallback" });
  const r = await runAgent({
    command: cmd,
    logFile: sm.files.p("commandsLog"),
    authPolicy: config.authPolicy,
    allowApiKeyEnv: opts.allowApiKeyEnv,
    onStdout: l => process.stdout.write(l + "\n"),
    onStderr: l => process.stderr.write(l + "\n"),
  });
  if (r.error) {
    console.error(r.error);
    const endedAt = new Date().toISOString();
    sm.updateMeta({
      status: "failed", lastError: r.error, lastAgent: "claude", activeAgent: "none",
      endedAt, durationMs: Date.parse(endedAt) - Date.parse(startedAt),
    });
    process.exit(1);
  }
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
