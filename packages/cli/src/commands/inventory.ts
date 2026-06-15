import { DependencyInventory } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface InventoryOpts extends ProjectOpts {
  json?: boolean;
}

export async function inventoryCommand(opts: InventoryOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const inv = new DependencyInventory(repoRoot).generate();

  if (opts.json) {
    console.log(JSON.stringify(inv, null, 2));
    return;
  }

  console.log(`[relay-baton] inventory: ${inv.repoRoot}`);
  console.log(`dependency manifests: ${inv.dependencyManifests.join(", ") || "-"}`);
  console.log(`root scripts: ${inv.rootScripts.join(", ") || "-"}`);
  if (inv.packages.length) {
    console.log(`workspace packages (${inv.packages.length}):`);
    for (const p of inv.packages) console.log(`  - ${p.name}: ${p.scripts.join(", ") || "(no scripts)"}`);
  }
  console.log(`CI workflows: ${inv.ciWorkflows.join(", ") || "-"}`);
  console.log(`release files: ${inv.releaseFiles.join(", ") || "-"}`);
}
