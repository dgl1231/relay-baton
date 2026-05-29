import { ConfigLoader, SessionManager, PlanReview, ConversationLog } from "@relay-baton/core";
import type { ReviewResult } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface ReviewOpts extends ProjectOpts {
  json?: boolean;
}

/** Build the one-line summary persisted to the conversation event log. */
export function reviewSummaryLine(r: ReviewResult): string {
  return (
    `plan ${r.planPresent ? "present" : "missing"}; ` +
    `${r.steps.length} steps (${r.touchedSteps} touched, ${r.untouchedSteps} untouched, ` +
    `${r.uncorrelatedSteps} uncorrelated); ` +
    `${r.changedFiles.length} changed, ${r.unplannedFiles.length} unplanned`
  );
}

export async function reviewCommand(opts: ReviewOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  const meta = sm.getMeta();

  const result = new PlanReview(repoRoot, config).run();

  // Persist as an append-only conversation event (best-effort, summary only).
  new ConversationLog(repoRoot).append({
    role: "relay-baton",
    kind: "review",
    text: reviewSummaryLine(result),
    sessionId: meta?.id,
    refs: { plan: "plan.md", changedFiles: "changed-files.md" },
    meta: {
      stepRefs: result.steps.filter(s => s.touched).map(s => `step-${s.index}`),
    },
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("=== relay-baton review (deterministic, no model call) ===");
  console.log("plan.md present:", result.planPresent);
  if (!result.planPresent) {
    console.log("No plan.md found. Run `relay-baton plan <task>` first.");
  }
  console.log("");
  console.log(
    `steps: ${result.steps.length}  ` +
      `(touched ${result.touchedSteps}, untouched ${result.untouchedSteps}, uncorrelated ${result.uncorrelatedSteps})`,
  );

  for (const s of result.steps) {
    const mark = s.touched ? "[done?]" : s.referencedPaths.length === 0 ? "[----]" : "[todo?]";
    console.log(`  ${mark} ${s.index}. ${s.text}`);
    if (s.matchedFiles.length) {
      console.log(`         matched: ${s.matchedFiles.join(", ")}`);
    }
  }

  console.log("");
  console.log(`changed files: ${result.changedFiles.length}`);
  if (result.unplannedFiles.length) {
    console.log(`unplanned changes (${result.unplannedFiles.length}):`);
    for (const f of result.unplannedFiles) console.log(`  - ${f}`);
  } else {
    console.log("unplanned changes: none");
  }

  console.log("");
  console.log("test-results summary:", result.testResultsSummary ?? "(none)");
  console.log("handoff.md present:", result.handoffPresent);
}
