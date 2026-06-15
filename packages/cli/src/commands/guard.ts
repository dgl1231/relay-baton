import { ConfigLoader, GuardrailPolicy } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface GuardOpts extends ProjectOpts {
  json?: boolean;
  /** Exit non-zero (10) when a stop condition is triggered. */
  exitCode?: boolean;
}

export async function guardCommand(opts: GuardOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const { config } = ConfigLoader.load(repoRoot);
  const report = new GuardrailPolicy(repoRoot, config).evaluate();

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const verdict = report.blocked ? "BLOCKED" : "ok";
    console.log(`[relay-baton] guardrails: ${verdict}`);
    const { actual, limits } = report;
    console.log(`steps: ${actual.steps}/${limits.maxSteps ?? "∞"}`);
    console.log(`changed files: ${actual.changedFiles}/${limits.maxChangedFiles ?? "∞"}`);
    console.log(`budget ratio: ${actual.budgetRatio == null ? "-" : actual.budgetRatio.toFixed(2)}/${limits.maxBudgetRatio ?? "∞"}`);
    if (report.requireConfirmation) console.log("mutating steps require explicit human confirmation");
    for (const v of report.violations) console.log(`- ${v.condition}: ${v.message}`);
  }

  // Advisory by default (read-only report). With --exit-code, a triggered stop
  // condition sets a non-zero exit so a script/agent loop can halt — relay-baton
  // still never halts an agent on its own.
  if (opts.exitCode && report.blocked) process.exitCode = 10;
}
