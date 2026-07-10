import * as fs from "fs";
import * as path from "path";
import { ConfigLoader, SessionManager } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";
import { Check, CheckStatus, coreChecks, deepChecks } from "./diagnostics";
import { color } from "../ui";

function icon(status: CheckStatus): string {
  return status === "ok" ? color.green("✓")
    : status === "warn" ? color.yellow("▲")
    : status === "info" ? color.cyan("•")
    : color.red("✗");
}

function printCheck(c: Check) {
  console.log(`  ${icon(c.status)}  ${c.label.padEnd(26)} ${color.dim(c.value)}`);
}

function section(title: string) {
  console.log(`\n${color.bold(color.cyan(title))}`);
}

export interface DoctorOpts extends ProjectOpts {
  deep?: boolean;
}

export async function doctorCommand(opts: DoctorOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const cfgLoad = ConfigLoader.load(repoRoot);
  const cfg = cfgLoad.config;

  console.log(`${color.bold("relay-baton doctor" + (opts.deep ? " --deep" : ""))}  ${color.dim(repoRoot)}`);

  const core = coreChecks(repoRoot, cfg);
  section("Core");
  for (const c of core) printCheck(c);
  printCheck({ status: "info", label: "config source", value: cfgLoad.source + (cfgLoad.error ? ` (error: ${cfgLoad.error})` : "") });
  printCheck({ status: "info", label: "AGENTS.md", value: fs.existsSync(path.join(repoRoot, "AGENTS.md")) ? "exists" : "missing" });
  printCheck({ status: "info", label: "CLAUDE.md", value: fs.existsSync(path.join(repoRoot, "CLAUDE.md")) ? "exists" : "missing" });
  // v2.8 discoverability: surface whether the optional threshold handoff
  // triggers are configured (they are off unless the config block exists).
  const ht = cfg.handoffTriggers;
  const htSet = ht && (ht.budgetRatio != null || ht.changedFiles != null || ht.usageTokensProxy != null);
  printCheck({
    status: "info", label: "handoff triggers",
    value: htSet
      ? Object.entries(ht!).filter(([, v]) => v != null).map(([k, v]) => `${k}=${v}`).join(", ")
      : "not set (optional — see handoffTriggers in docs/COMMANDS.md)",
  });

  let deep: Check[] = [];
  if (opts.deep) {
    deep = deepChecks(repoRoot, cfg);
    section("Deep diagnostics");
    for (const c of deep) printCheck(c);
  }

  const all = [...core, ...deep];
  const fails = all.filter(c => c.status === "fail").length;
  const warns = all.filter(c => c.status === "warn").length;

  section("Summary");
  if (fails > 0) {
    console.log(`  ${color.red(`${fails} failure(s)`)}, ${warns} warning(s).`);
  } else if (warns > 0) {
    console.log(`  ${color.yellow(`${warns} warning(s)`)}, no failures.`);
  } else {
    console.log(`  ${color.green("All checks passed.")}`);
  }

  if (!opts.deep) {
    console.log(color.dim("  ↳ Run `relay-baton doctor --deep` for extended diagnostics."));
  }

  // doctor never exits non-zero on warnings; only on hard failures.
  if (fails > 0) process.exitCode = 1;

  // Touch SessionManager so an uninitialized repo still gives a hint.
  const sm = new SessionManager(repoRoot, cfg);
  if (!fs.existsSync(sm.files.dir)) {
    console.log(color.dim("  ↳ Run `relay-baton init` to create .ai-session/."));
  }
}
