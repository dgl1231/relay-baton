import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import {
  ConfigLoader,
  SessionManager,
  FallbackDetector,
  BatonWorkflow,
  createAgentEnv,
} from "@relay-baton/core";
import type { DietProfileName } from "@relay-baton/shared";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";
import { coreChecks } from "./diagnostics";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

export interface VerifyOpts extends ProjectOpts {
  diet?: DietProfileName;
  realAgents?: boolean;
  keepTemp?: boolean;
  verbose?: boolean;
}

type StepStatus = "pass" | "fail" | "warn";

interface StepResult {
  name: string;
  status: StepStatus;
  detail: string;
}

function mark(status: StepStatus): string {
  return status === "pass" ? `${GREEN}PASS${RESET}`
    : status === "warn" ? `${YELLOW}WARN${RESET}`
    : `${RED}FAIL${RESET}`;
}

/**
 * `verify` runs a deterministic, simulated end-to-end pass over the relay-baton
 * pipeline WITHOUT calling any real model. It proves the wiring works: repo
 * resolution, environment, fallback detection, handoff generation (no-run),
 * token budget, and the API-key env block.
 */
export async function verifyCommand(opts: VerifyOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const { config } = ConfigLoader.load(repoRoot);
  const results: StepResult[] = [];
  const log = (s: string) => { if (opts.verbose) console.log(`${DIM}  ${s}${RESET}`); };

  console.log(`${BOLD}relay-baton verify${RESET}  ${DIM}${repoRoot}${RESET}`);
  if (opts.realAgents) {
    console.log(`${YELLOW}--real-agents is experimental scaffolding and is NOT executed; running simulated checks only.${RESET}`);
  }

  // 1) repoRoot resolution + doctor core checks.
  const core = coreChecks(repoRoot, config);
  const coreFail = core.filter(c => c.status === "fail");
  results.push({
    name: "environment (doctor core)",
    status: coreFail.length > 0 ? "fail" : "pass",
    detail: coreFail.length > 0 ? `failing: ${coreFail.map(c => c.label).join(", ")}` : `${core.length} checks ok`,
  });

  // 2) Fallback phrase simulation: real phrases detected, grep/result-like lines ignored.
  const detector = new FallbackDetector(config.fallbackPatterns);
  const realPhrase = config.fallbackPatterns[0] ?? "usage limit reached";
  const simulatedOutput = [
    "Working on the task...",
    "src/foo.ts:42:  // mentions rate limit exceeded in a comment", // grep-like: must be ignored
    `Error: ${realPhrase} — please try again later.`,                // real: must be detected
  ];
  let detectedReal = false;
  let detectedNoise = false;
  for (const line of simulatedOutput) {
    const hit = detector.feed(line);
    if (!hit) continue;
    if (line.includes(":42:")) detectedNoise = true;
    else detectedReal = true;
    log(`fallback hit: ${hit.pattern}`);
  }
  results.push({
    name: "fallback detection",
    status: detectedReal && !detectedNoise ? "pass" : "fail",
    detail: detectedReal
      ? (detectedNoise ? "detected real phrase but also matched a grep-like line" : "detected real phrase, ignored grep-like line")
      : "did not detect the simulated fallback phrase",
  });

  // 3) Handoff no-run workflow against a throwaway temp repo (never touches the real .ai-session).
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "relay-baton-verify-"));
  let handoffOk = false;
  let handoffDetail = "";
  try {
    // Real git init + empty commit so GitService.diff("HEAD") is clean (no noise).
    const g = (args: string[]) => spawnSync("git", args, { cwd: tmpRoot, encoding: "utf8", stdio: "ignore" });
    g(["init"]);
    g(["config", "user.email", "verify@relay-baton.local"]);
    g(["config", "user.name", "relay-baton verify"]);
    g(["commit", "--allow-empty", "-m", "verify base"]);
    const sm = new SessionManager(tmpRoot, config);
    sm.init("verify: simulated handoff (no real agent)");
    sm.updateMeta({ fallbackReason: `simulated fallback: ${realPhrase}`, lastAgent: "codex" });
    const diet = (opts.diet ?? config.tokenDiet.profile);
    const wf = new BatonWorkflow(sm, config);
    const result = wf.buildHandoff({
      profileName: diet,
      fallbackReason: `simulated fallback: ${realPhrase}`,
      previousAgent: "codex",
      nextAgent: "claude",
    });
    handoffOk = fs.existsSync(result.handoffPath) && fs.readFileSync(result.handoffPath, "utf8").trim().length > 0;
    handoffDetail = handoffOk ? `wrote ${path.basename(result.handoffPath)} (diet=${diet}, ${result.usedChars} chars)` : "handoff.md missing or empty";
    log(`temp handoff: ${result.handoffPath}`);
  } catch (e: any) {
    handoffDetail = `error: ${e?.message ?? e}`;
  }
  results.push({ name: "handoff (no-run)", status: handoffOk ? "pass" : "fail", detail: handoffDetail });

  // 4) Token budget check on the generated handoff.
  let budgetOk = false;
  let budgetDetail = "";
  try {
    const sm = new SessionManager(tmpRoot, config);
    const handoff = fs.readFileSync(sm.files.p("handoff"), "utf8");
    const diet = opts.diet ?? config.tokenDiet.profile;
    const max = config.tokenDiet.profiles[diet]?.maxHandoffChars ?? 0;
    budgetOk = max === 0 || handoff.length <= max;
    budgetDetail = `${handoff.length} chars / ${max} budget (${diet})`;
  } catch (e: any) {
    budgetDetail = `error: ${e?.message ?? e}`;
  }
  results.push({ name: "token budget", status: budgetOk ? "pass" : "warn", detail: budgetDetail });

  // 5) API key env block check (default policy strips blocked vars).
  let envOk = true;
  let envDetail = "blocked vars stripped from child env";
  try {
    const fakeEnv = { ...process.env } as NodeJS.ProcessEnv;
    for (const ev of config.authPolicy.blockedEnvVars) fakeEnv[ev] = "test-secret-should-be-stripped";
    const { env: childEnv } = createAgentEnv(fakeEnv, config.authPolicy, false);
    const leaked = config.authPolicy.blockedEnvVars.filter(ev => childEnv[ev] != null);
    envOk = leaked.length === 0;
    envDetail = envOk ? "blocked vars stripped from child env" : `LEAKED: ${leaked.join(", ")}`;
  } catch (e: any) {
    envOk = false;
    envDetail = `error: ${e?.message ?? e}`;
  }
  results.push({ name: "api-key env block", status: envOk ? "pass" : "fail", detail: envDetail });

  // Cleanup temp repo.
  if (!opts.keepTemp) {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* best effort */ }
  } else {
    console.log(`${DIM}  kept temp repo: ${tmpRoot}${RESET}`);
  }

  // Summary.
  console.log(`\n${CYAN}${BOLD}Verification steps${RESET}`);
  for (const r of results) {
    console.log(`  ${mark(r.status)}  ${r.name.padEnd(28)} ${DIM}${r.detail}${RESET}`);
  }
  const fails = results.filter(r => r.status === "fail").length;
  const warns = results.filter(r => r.status === "warn").length;
  console.log("");
  if (fails > 0) {
    console.log(`${RED}verify FAILED — ${fails} failing step(s), ${warns} warning(s).${RESET}`);
    process.exitCode = 1;
  } else if (warns > 0) {
    console.log(`${YELLOW}verify passed with ${warns} warning(s).${RESET}`);
  } else {
    console.log(`${GREEN}verify passed — pipeline wiring is healthy (no real model calls).${RESET}`);
  }
}
