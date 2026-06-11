import { ConfigLoader, SessionArchiver } from "@relay-baton/core";
import { resolveRepoRoot } from "./projectOptions";

export interface SessionArchiveOpts {
  project?: string;
  path?: string;
  json?: boolean;
  dryRun?: boolean;
  out?: string;
}

export async function sessionArchiveCommand(opts: SessionArchiveOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  ConfigLoader.load(repoRoot);
  const result = new SessionArchiver(repoRoot).archive({
    archiveRoot: opts.out,
    dryRun: opts.dryRun,
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.available) {
    console.log(`[relay-baton] session archive unavailable: ${result.reason}`);
    return;
  }

  const count = result.manifest?.files.length ?? 0;
  const prefix = result.dryRun ? "would archive" : "archived";
  console.log(`[relay-baton] ${prefix} ${count} file(s)`);
  console.log(`archive: ${result.archiveDir}`);
  if (!result.dryRun) console.log("manifest: manifest.json");
}
