import * as fs from "fs";
import { ConfigLoader, SessionManager } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface BudgetOpts extends ProjectOpts {
  json?: boolean;
}

export async function budgetCommand(opts: BudgetOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  const meta = sm.getMeta();
  const activeProfile = meta?.tokenDietProfile ?? config.tokenDiet.profile;
  const profile = config.tokenDiet.profiles[activeProfile];

  const read = (p: string) => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; }};
  const handoff = read(sm.files.p("handoff"));
  const repoMap = read(sm.files.p("repoMap"));
  const fullDiff = read(sm.files.p("fullDiff"));
  const log = read(sm.files.p("commandsLog"));
  const compactState = read(sm.files.p("compactState"));

  let budgetSnap: any = null;
  try { budgetSnap = JSON.parse(read(sm.files.p("contextBudget"))); } catch {/**/}

  if (opts.json) {
    console.log(JSON.stringify({
      activeProfile,
      maxHandoffChars: profile.maxHandoffChars,
      used: {
        handoff: handoff.length,
        repoMap: repoMap.length,
        fullDiff: fullDiff.length,
        commandsLog: log.length,
        compactState: compactState.length,
      },
      truncated: budgetSnap?.truncated ?? false,
    }, null, 2));
    return;
  }

  console.log("active profile:", activeProfile);
  console.log("maxHandoffChars:", profile.maxHandoffChars);
  console.log("handoff.md chars:", handoff.length);
  console.log("repo-map.md chars:", repoMap.length);
  console.log("full-diff.patch chars:", fullDiff.length);
  console.log("commands.log chars:", log.length);
  console.log("compact-state.md chars:", compactState.length);
  console.log("truncated:", budgetSnap?.truncated ?? false);
}
