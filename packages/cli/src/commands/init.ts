import { ConfigLoader, SessionManager } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";
import { ui, color } from "../ui";

export async function initCommand(opts: ProjectOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  const r = sm.init("");
  if (r.alreadyExisted && r.createdFiles.length === 0) {
    ui.ok(`.ai-session already exists at ${color.dim(r.dir)} — nothing to do.`);
  } else {
    ui.ok(`initialized ${color.dim(r.dir)}`);
    for (const f of r.createdFiles) console.log(color.dim(`  + ${f}`));
    ui.hint("next: relay-baton doctor to check your agents, then relay-baton run \"<task>\"");
  }
}
