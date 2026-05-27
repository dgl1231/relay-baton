import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import { ConfigLoader, SessionManager } from "@relay-baton/core";

function which(cmd: string): boolean {
  const r = spawnSync(cmd, ["--version"], { encoding: "utf8" });
  return r.error == null;
}

export async function doctorCommand() {
  const repoRoot = process.cwd();
  const cfgLoad = ConfigLoader.load(repoRoot);
  const cfg = cfgLoad.config;

  console.log("[relay-baton] doctor");
  console.log("  cwd:", repoRoot);

  const gitOk = fs.existsSync(path.join(repoRoot, ".git"));
  console.log("  git repository:", gitOk ? "yes" : "no");
  console.log("  git command:", which("git") ? "available" : "MISSING");
  console.log("  codex command:", which(cfg.agents.codex?.command ?? "codex") ? "available" : "missing");
  console.log("  claude command:", which(cfg.agents.claude?.command ?? "claude") ? "available" : "missing");

  for (const ev of cfg.authPolicy.blockedEnvVars) {
    const set = !!process.env[ev];
    if (set && cfg.authPolicy.warnIfApiKeyEnvDetected) {
      const billing =
        ev === "OPENAI_API_KEY"
          ? "Codex may use usage-based API billing depending on your Codex auth configuration."
          : "Claude Code may use API billing instead of subscription usage.";
      console.log("");
      console.log(`WARNING:\n${ev} is set in your environment.\nrelay-baton will not pass it to child processes by default.\nIf you allow it, ${billing}`);
      console.log("");
    } else {
      console.log(`  ${ev}:`, set ? "set (will be blocked by default)" : "not set");
    }
  }

  console.log("  authPolicy.allowApiKeyEnv:", cfg.authPolicy.allowApiKeyEnv);
  console.log("  config source:", cfgLoad.source + (cfgLoad.error ? ` (error: ${cfgLoad.error})` : ""));

  const sm = new SessionManager(repoRoot, cfg);
  console.log("  .ai-session:", fs.existsSync(sm.files.dir) ? "exists" : "missing");
  console.log("  AGENTS.md:", fs.existsSync(path.join(repoRoot, "AGENTS.md")) ? "exists" : "missing");
  console.log("  CLAUDE.md:", fs.existsSync(path.join(repoRoot, "CLAUDE.md")) ? "exists" : "missing");
}
