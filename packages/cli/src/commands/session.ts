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

export interface SessionPruneOpts {
  json?: boolean;
  out?: string;
  maxAgeDays?: string;
  maxCount?: string;
  apply?: boolean;
}

export async function sessionPruneCommand(opts: SessionPruneOpts = {}) {
  const maxAgeDays = opts.maxAgeDays != null ? Number.parseFloat(opts.maxAgeDays) : undefined;
  const maxCount = opts.maxCount != null ? Number.parseInt(opts.maxCount, 10) : undefined;
  for (const [flag, v] of [["--max-age-days", maxAgeDays], ["--max-count", maxCount]] as const) {
    if (v !== undefined && (!Number.isFinite(v) || v < 0)) {
      console.error(`[relay-baton] ${flag} must be a non-negative number`);
      process.exit(2);
    }
  }

  const result = new SessionArchiveStore({ archiveRoot: opts.out }).prune({
    maxAgeDays,
    maxCount,
    dryRun: !opts.apply,
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.available) {
    console.log(`[relay-baton] cannot prune: ${result.reason}`);
    return;
  }
  if (result.policy.maxAgeDays === null && result.policy.maxCount === null) {
    console.log("[relay-baton] no retention policy — pass --max-age-days and/or --max-count. Nothing pruned.");
    return;
  }

  const verb = result.dryRun ? "would prune" : "pruned";
  console.log(`[relay-baton] ${verb} ${result.pruned.length} archive(s), keeping ${result.kept.length}${result.dryRun ? " (dry-run)" : ""}`);
  for (const p of result.pruned) console.log(`- ${p.id} (${p.createdAt ?? "unknown"}) — ${p.reason}`);
  if (result.dryRun && result.pruned.length > 0) console.log("re-run with --apply to delete the above.");
}

export interface SessionExportOpts {
  json?: boolean;
  out?: string;
  to?: string;
  overwrite?: boolean;
}

export async function sessionExportCommand(archive: string, opts: SessionExportOpts = {}) {
  if (!opts.to) {
    console.error("[relay-baton] missing required option: --to <dir>");
    process.exit(2);
  }
  const result = new SessionArchiveStore({ archiveRoot: opts.out }).exportArchive(archive, opts.to, { overwrite: opts.overwrite });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (!result.available) {
    console.log(`[relay-baton] cannot export: ${result.reason}`);
    return;
  }
  console.log(`[relay-baton] exported ${result.id}`);
  console.log(`to: ${result.dest}`);
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
