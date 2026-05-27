import * as fs from "fs";
import { ConfigLoader, SessionManager } from "@relay-baton/core";

export async function statusCommand() {
  const repoRoot = process.cwd();
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  const meta = sm.getMeta();
  if (!meta) {
    console.log("[relay-baton] no session. Run `relay-baton init`.");
    return;
  }
  const handoff = sm.files.p("handoff");
  const budget = sm.files.p("contextBudget");
  const changed = sm.files.p("changedFiles");
  let changedCount = 0;
  try {
    const txt = fs.readFileSync(changed, "utf8");
    changedCount = txt.split("\n").filter(l => l.startsWith("- ")).length;
  } catch {/**/}

  console.log("task:", meta.task || "(none)");
  console.log("status:", meta.status);
  console.log("activeAgent:", meta.activeAgent);
  console.log("lastAgent:", meta.lastAgent);
  console.log("primaryAgent:", meta.primaryAgent);
  console.log("fallbackAgent:", meta.fallbackAgent);
  console.log("fallbackReason:", meta.fallbackReason ?? "(none)");
  console.log("tokenDietProfile:", meta.tokenDietProfile);
  console.log("changed files:", changedCount);
  console.log("handoff.md exists:", fs.existsSync(handoff));
  console.log("context-budget.json exists:", fs.existsSync(budget));
  console.log("lastError:", meta.lastError ?? "(none)");
}
