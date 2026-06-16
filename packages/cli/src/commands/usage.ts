import { ConfigLoader, SessionManager, UsageLedger } from "@relay-baton/core";
import type { DietProfileName } from "@relay-baton/shared";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface UsageOpts extends ProjectOpts {
  json?: boolean;
}

/**
 * v2.4 — local usage insight. Aggregates the per-session usage ledger
 * (`.ai-session/usage.jsonl`) into a token-proxy summary for budgeting. Read-only
 * and local: nothing is transmitted, and the proxy is ceil(chars/4), not a real
 * tokenizer.
 */
export async function usageCommand(opts: UsageOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  const activeProfile = (sm.getMeta()?.tokenDietProfile ?? config.tokenDiet.profile) as DietProfileName;
  const maxHandoffChars = config.tokenDiet.profiles[activeProfile]?.maxHandoffChars;

  const summary = new UsageLedger(repoRoot).summarize(maxHandoffChars);

  if (opts.json) {
    console.log(JSON.stringify({ activeProfile, maxHandoffChars, ...summary }, null, 2));
    return;
  }

  if (!summary.available) {
    console.log("[relay-baton] no usage recorded yet (run a relay/handoff first).");
    return;
  }

  console.log(`[relay-baton] usage (local only — ${summary.proxyNote})`);
  console.log(`active profile: ${activeProfile} (maxHandoffChars=${maxHandoffChars})`);
  console.log(`events: ${summary.events} · handoffs: ${summary.handoffCount}`);
  console.log(`total: ${summary.totalChars} chars ≈ ${summary.totalTokensProxy} tokens (proxy)`);
  if (summary.budgetRatio !== null) {
    console.log(`budget ratio vs one handoff budget: ${summary.budgetRatio}×`);
  }
  console.log("by type:");
  for (const [k, v] of Object.entries(summary.byType)) console.log(`  - ${k}: ${v} tokens`);
  console.log("by agent:");
  for (const [k, v] of Object.entries(summary.byAgent)) console.log(`  - ${k}: ${v} tokens`);
}
