import { RiskClassifier } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface RiskOpts extends ProjectOpts {
  json?: boolean;
}

export async function riskCommand(opts: RiskOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const report = new RiskClassifier(repoRoot).evaluate();

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (!report.available) {
    console.log("[relay-baton] risk: not a git repository.");
    return;
  }
  if (!report.risky) {
    console.log("[relay-baton] risk: no risky surfaces in the working tree.");
    return;
  }
  console.log(`[relay-baton] risk: ${report.findings.length} finding(s) · ${report.bySeverity.high} high · ${report.bySeverity.medium} medium`);
  for (const f of report.findings) {
    console.log(`- [${f.severity}] ${f.category}: ${f.code} ${f.path} (${f.reason})`);
  }
}
