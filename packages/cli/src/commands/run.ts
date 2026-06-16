import {
  ConfigLoader, SessionManager, GitService, BatonWorkflow,
  FallbackDetector, resolveFallbackPatterns, runAgent,
  HandoffQualityGate, TokenDietQualityGate, PromptBuilder, ContextCompressor,
  agentFallbackPatterns, isAgentId, UsageLedger,
} from "@relay-baton/core";
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
}

/**
 * Deterministic "who's next" policy (v2.3): the relay chain is an ordered list
 * of agents. `--chain` wins; otherwise it is [primary, fallback] resolved from
 * flags > project overrides > config. Supports reverse (claude->codex) and
 * longer chains, not just codex->claude.
 */
export function resolveChain(opts: RunOpts, project: { primaryAgent?: AgentId; fallbackAgent?: AgentId } | undefined, config: { primaryAgent: AgentId; fallbackAgent: AgentId }): AgentId[] {
  let ids: string[];
  if (opts.chain) {
    ids = opts.chain.split(",").map(s => s.trim()).filter(Boolean);
  } else {
    const primary = opts.primary ?? project?.primaryAgent ?? config.primaryAgent;
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

  const chain = resolveChain(opts, projectContext.project, config);
  console.log(`[relay-baton] relay chain: ${chain.join(" → ")}`);

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
