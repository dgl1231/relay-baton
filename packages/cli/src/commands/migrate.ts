import { ConfigLoader, SchemaInspector } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface MigrateOpts extends ProjectOpts {
  check?: boolean;
  json?: boolean;
}

export async function migrateCommand(opts: MigrateOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  ConfigLoader.load(repoRoot);
  const report = new SchemaInspector(repoRoot).inspect();

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (!report.exists) {
    console.log("[relay-baton] no .ai-session to check.");
    return;
  }

  console.log(`[relay-baton] artifact schemas: ${report.ok ? "ok" : "ATTENTION"}`);
  for (const c of report.checks) {
    const found = c.foundVersion == null ? "-" : `v${c.foundVersion}`;
    console.log(`- ${c.file}: ${c.status} (${found}/v${c.currentVersion}) — ${c.guidance}`);
  }

  // This release ships detection + guidance only (read-only). Actual in-place
  // migration lands with the first real schema-version bump; until then there is
  // nothing to rewrite, so even without --check we never mutate artifacts.
  if (!opts.check) {
    if (report.migratable) {
      console.log("note: migration apply is not available yet; legacy artifacts are read as v1. No files changed.");
    } else {
      console.log("nothing to migrate.");
    }
  }
}
