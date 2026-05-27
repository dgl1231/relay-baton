import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import { ConfigLoader, SessionManager } from "@relay-baton/core";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function which(cmd: string): boolean {
  const r = spawnSync(cmd, ["--version"], { encoding: "utf8" });
  return r.error == null;
}

function row(ok: boolean | "warn" | "info", label: string, value: string) {
  const icon = ok === true ? `${GREEN}✓${RESET}`
    : ok === "warn" ? `${YELLOW}!${RESET}`
    : ok === "info" ? `${CYAN}•${RESET}`
    : `${RED}✗${RESET}`;
  console.log(`  ${icon}  ${label.padEnd(26)} ${DIM}${value}${RESET}`);
}

function section(title: string) {
  console.log(`\n${CYAN}${BOLD}${title}${RESET}`);
}

export async function doctorCommand() {
  const repoRoot = process.cwd();
  const cfgLoad = ConfigLoader.load(repoRoot);
  const cfg = cfgLoad.config;

  console.log(`${BOLD}relay-baton doctor${RESET}  ${DIM}${repoRoot}${RESET}`);

  section("Environment");
  const gitOk = fs.existsSync(path.join(repoRoot, ".git"));
  row(gitOk, "git repository", gitOk ? "yes" : "no (run inside a git repo)");
  row(which("git"), "git command", which("git") ? "available" : "MISSING");

  section("Agents");
  const codexOk = which(cfg.agents.codex?.command ?? "codex");
  const claudeOk = which(cfg.agents.claude?.command ?? "claude");
  row(codexOk, "codex command", codexOk ? "available" : "missing — run `relay-baton login codex`");
  row(claudeOk, "claude command", claudeOk ? "available" : "missing — run `relay-baton login claude`");

  section("Auth / Billing");
  for (const ev of cfg.authPolicy.blockedEnvVars) {
    const set = !!process.env[ev];
    if (set && cfg.authPolicy.warnIfApiKeyEnvDetected) {
      row("warn", ev, "set — blocked by default (use --allow-api-key-env to pass through)");
    } else {
      row("info", ev, set ? "set (blocked by default)" : "not set");
    }
  }
  row("info", "authPolicy.allowApiKeyEnv", String(cfg.authPolicy.allowApiKeyEnv));
  row("info", "config source", cfgLoad.source + (cfgLoad.error ? ` (error: ${cfgLoad.error})` : ""));

  section("Session");
  const sm = new SessionManager(repoRoot, cfg);
  row(fs.existsSync(sm.files.dir), ".ai-session", fs.existsSync(sm.files.dir) ? sm.files.dir : "missing — run `relay-baton init`");
  row("info", "AGENTS.md", fs.existsSync(path.join(repoRoot, "AGENTS.md")) ? "exists" : "missing");
  row("info", "CLAUDE.md", fs.existsSync(path.join(repoRoot, "CLAUDE.md")) ? "exists" : "missing");

  const next: string[] = [];
  if (!gitOk) next.push("Initialize a git repository first.");
  if (!codexOk) next.push("Install Codex CLI, then `relay-baton login codex`.");
  if (!claudeOk) next.push("Install Claude Code CLI, then `relay-baton login claude`.");
  if (!fs.existsSync(sm.files.dir)) next.push("Run `relay-baton init` to create .ai-session/.");
  if (next.length > 0) {
    section("Next steps");
    for (const n of next) console.log(`  ${DIM}→${RESET} ${n}`);
  } else {
    console.log(`\n${GREEN}All checks passed.${RESET}`);
  }
}
