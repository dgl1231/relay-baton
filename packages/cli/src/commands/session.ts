import { ConfigLoader, SessionArchiver, SessionArchiveStore, ResumeDiagnostics } from "@relay-baton/core";
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

export interface SessionListOpts {
  json?: boolean;
  out?: string;
}

export async function sessionListCommand(opts: SessionListOpts = {}) {
  const result = new SessionArchiveStore({ archiveRoot: opts.out }).list();

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.available) {
    console.log(`[relay-baton] no session archives: ${result.reason}`);
    console.log(`archive root: ${result.archiveRoot}`);
    return;
  }

  if (result.archives.length === 0) {
    console.log("[relay-baton] no session archives found");
    console.log(`archive root: ${result.archiveRoot}`);
    return;
  }

  console.log(`[relay-baton] ${result.archives.length} session archive(s) in ${result.archiveRoot}`);
  for (const a of result.archives) {
    const flag = a.valid ? "" : " (invalid)";
    const when = a.createdAt ?? "unknown";
    console.log(`- ${a.id}${flag}  ${a.fileCount} file(s), ${a.totalBytes} bytes, ${when}`);
  }
}

export interface SessionInspectOpts {
  json?: boolean;
  out?: string;
}

export async function sessionInspectCommand(archive: string, opts: SessionInspectOpts = {}) {
  const result = new SessionArchiveStore({ archiveRoot: opts.out }).inspect(archive);

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.available) {
    console.log(`[relay-baton] cannot inspect archive: ${result.reason}`);
    return;
  }

  console.log(`[relay-baton] archive ${result.id}`);
  console.log(`repoRoot: ${result.repoRoot ?? "unknown"}`);
  console.log(`createdAt: ${result.createdAt ?? "unknown"}`);
  console.log(`files: ${result.fileCount}, total ${result.totalBytes} bytes`);
  console.log(`integrity: ${result.intact ? "intact" : "DAMAGED"}`);
  if (result.missing.length > 0) console.log(`missing: ${result.missing.join(", ")}`);
  if (result.corrupt.length > 0) console.log(`corrupt: ${result.corrupt.join(", ")}`);
}

export interface SessionResumeOpts {
  project?: string;
  path?: string;
  json?: boolean;
  staleHours?: string;
}

export async function sessionResumeCommand(opts: SessionResumeOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  ConfigLoader.load(repoRoot);
  const staleHours = opts.staleHours != null ? Number.parseFloat(opts.staleHours) : undefined;
  const result = new ResumeDiagnostics(repoRoot).diagnose({
    staleHours: Number.isFinite(staleHours as number) ? staleHours : undefined,
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`[relay-baton] session resume diagnosis: ${result.status}`);
  if (result.meta?.task) console.log(`task: ${result.meta.task}`);
  if (result.findings.length > 0) {
    console.log("findings:");
    for (const f of result.findings) console.log(`- ${f}`);
  } else {
    console.log("findings: none");
  }
  console.log("suggested next:");
  for (const s of result.suggestions) console.log(`- relay-baton ${s.command}  (${s.reason})`);
}
