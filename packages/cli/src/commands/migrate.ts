import { ConfigLoader, SchemaInspector, SchemaMigrator } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface MigrateOpts extends ProjectOpts {
  check?: boolean;
  apply?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

export async function migrateCommand(opts: MigrateOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  ConfigLoader.load(repoRoot);

  // Apply path is opt-in (--apply). Default and --check are read-only detection.
  if (opts.apply) {
    const dryRun = opts.dryRun === true;
    const result = new SchemaMigrator(repoRoot).migrate({ dryRun });
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (!result.exists) { console.log("[relay-baton] no .ai-session to migrate."); return; }
    const verb = dryRun ? "would migrate" : "migrated";
    const acted = result.actions.filter(a => a.kind !== "skip");
    if (acted.length === 0) {
      console.log("[relay-baton] nothing to migrate; all artifacts are current.");
    } else {
      console.log(`[relay-baton] ${verb} ${acted.length} artifact(s)${dryRun ? " (dry-run)" : ""}`);
      for (const a of result.actions) console.log(`- ${a.file}: ${a.kind} — ${a.note}`);
      if (result.backups.length) console.log(`backups: ${result.backups.length} written (.bak.<ts>)`);
    }
    return;
  }

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
  if (report.migratable) {
    console.log("run `relay-baton migrate --apply --dry-run` to preview, then `--apply` to normalize (writes a .bak backup).");
  } else {
    console.log("nothing to migrate.");
  }
}
