import { WorkspaceMap } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface WorkspaceOpts extends ProjectOpts {
  json?: boolean;
}

export async function workspaceCommand(opts: WorkspaceOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const map = new WorkspaceMap(repoRoot).generate();

  if (opts.json) {
    console.log(JSON.stringify(map, null, 2));
    return;
  }

  console.log(`[relay-baton] workspace map: ${repoRoot}`);
  console.log(`package managers: ${map.packageManagers.join(", ") || "-"}`);
  console.log(`languages: ${map.languages.join(", ") || "-"}`);
  console.log(`monorepo: ${map.monorepo ? "yes" : "no"}${map.packages.length ? ` (${map.packages.length} package(s))` : ""}`);
  for (const p of map.packages) console.log(`  - ${p.name} (${p.path})`);
  console.log(`build: ${map.scripts.build ?? "-"}`);
  console.log(`test: ${map.scripts.test ?? "-"}`);
  console.log(`lint: ${map.scripts.lint ?? "-"}`);
  if (map.scripts.others.length) console.log(`other scripts: ${map.scripts.others.join(", ")}`);
  console.log(`entry points: ${map.entryPoints.join(", ") || "-"}`);
  console.log(`docs: ${map.docs.join(", ") || "-"}`);
  console.log(`agents files: ${map.agentsFiles.join(", ") || "-"}`);
}
