import * as fs from "fs";
import * as path from "path";
import { ConfigLoader, SessionManager } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";
import { Check, CheckStatus, coreChecks, deepChecks } from "./diagnostics";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function icon(status: CheckStatus): string {
  return status === "ok" ? `${GREEN}✓${RESET}`
    : status === "warn" ? `${YELLOW}!${RESET}`
    : status === "info" ? `${CYAN}•${RESET}`
    : `${RED}✗${RESET}`;
}

function printCheck(c: Check) {
  console.log(`  ${icon(c.status)}  ${c.label.padEnd(26)} ${DIM}${c.value}${RESET}`);
}

function section(title: string) {
  console.log(`\n${CYAN}${BOLD}${title}${RESET}`);
}

export interface DoctorOpts extends ProjectOpts {
  deep?: boolean;
}

export async function doctorCommand(opts: DoctorOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const cfgLoad = ConfigLoader.load(repoRoot);
  const cfg = cfgLoad.config;

  console.log(`${BOLD}relay-baton doctor${opts.deep ? " --deep" : ""}${RESET}  ${DIM}${repoRoot}${RESET}`);

  const core = coreChecks(repoRoot, cfg);
  section("Core");
  for (const c of core) printCheck(c);
  printCheck({ status: "info", label: "config source", value: cfgLoad.source + (cfgLoad.error ? ` (error: ${cfgLoad.error})` : "") });
  printCheck({ status: "info", label: "AGENTS.md", value: fs.existsSync(path.join(repoRoot, "AGENTS.md")) ? "exists" : "missing" });
  printCheck({ status: "info", label: "CLAUDE.md", value: fs.existsSync(path.join(repoRoot, "CLAUDE.md")) ? "exists" : "missing" });

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
    console.log(`  ${RED}${fails} failure(s)${RESET}, ${warns} warning(s).`);
  } else if (warns > 0) {
    console.log(`  ${YELLOW}${warns} warning(s)${RESET}, no failures.`);
  } else {
    console.log(`  ${GREEN}All checks passed.${RESET}`);
  }

  if (!opts.deep) {
    console.log(`  ${DIM}Run \`relay-baton doctor --deep\` for extended diagnostics.${RESET}`);
  }

  // doctor never exits non-zero on warnings; only on hard failures.
  if (fails > 0) process.exitCode = 1;

  // Touch SessionManager so an uninitialized repo still gives a hint.
  const sm = new SessionManager(repoRoot, cfg);
  if (!fs.existsSync(sm.files.dir)) {
    console.log(`  ${DIM}→ Run \`relay-baton init\` to create .ai-session/.${RESET}`);
  }
}
