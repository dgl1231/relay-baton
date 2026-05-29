import * as fs from "fs";
import { ConfigLoader, SessionManager } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface StatusOpts extends ProjectOpts {
  json?: boolean;
}

export async function statusCommand(opts: StatusOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  const meta = sm.getMeta();
  if (!meta) {
    if (opts.json) {
      console.log(JSON.stringify({ session: false }, null, 2));
      return;
    }
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

  if (opts.json) {
    console.log(JSON.stringify({
      session: true,
      task: meta.task || null,
      status: meta.status,
      activeAgent: meta.activeAgent,
      lastAgent: meta.lastAgent,
      primaryAgent: meta.primaryAgent,
      fallbackAgent: meta.fallbackAgent,
      fallbackReason: meta.fallbackReason ?? null,
      tokenDietProfile: meta.tokenDietProfile,
      changedFiles: changedCount,
      handoffExists: fs.existsSync(handoff),
      contextBudgetExists: fs.existsSync(budget),
      lastError: meta.lastError ?? null,
    }, null, 2));
    return;
  }

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
