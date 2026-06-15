import * as fs from "fs";
import { type VersionedArtifact } from "@relay-baton/shared";
import { SessionFiles } from "./SessionFiles";
import { SchemaInspector } from "./SchemaInspector";

export interface MigrationAction {
  artifact: VersionedArtifact;
  file: string;
  fromVersion: number | null;
  toVersion: number;
  kind: "normalize-legacy" | "upgrade" | "skip";
  applied: boolean;
  note: string;
}

export interface MigrationResult {
  sessionDir: string;
  exists: boolean;
  dryRun: boolean;
  actions: MigrationAction[];
  backups: string[];
}

/**
 * Applies safe, deterministic schema migrations to `.ai-session` artifacts.
 *
 * Today the only migration is **legacy normalization**: artifacts that predate
 * the schemaVersion field get the current version stamped on them. Real
 * version-to-version upgrades will plug in here when a schema is bumped (an
 * `outdated` artifact is reported but skipped until its migrator exists). Every
 * write is preceded by a timestamped `.bak.<ts>` backup, and `dryRun` reports
 * the plan without touching anything.
 */
export class SchemaMigrator {
  private files: SessionFiles;
  constructor(private repoRoot: string) {
    this.files = new SessionFiles(repoRoot);
  }

  migrate(options: { dryRun?: boolean } = {}): MigrationResult {
    const dryRun = options.dryRun !== false; // default: dry-run (safe)
    const report = new SchemaInspector(this.repoRoot).inspect();
    const result: MigrationResult = {
      sessionDir: this.files.dir,
      exists: report.exists,
      dryRun,
      actions: [],
      backups: [],
    };
    if (!report.exists) return result;

    for (const check of report.checks) {
      if (check.status === "legacy") {
        result.actions.push(this.normalize(check.artifact, check.file, check.currentVersion, dryRun, result));
      } else if (check.status === "outdated") {
        result.actions.push({
          artifact: check.artifact, file: check.file, fromVersion: check.foundVersion, toVersion: check.currentVersion,
          kind: "skip", applied: false,
          note: `no migrator registered for v${check.foundVersion} -> v${check.currentVersion}`,
        });
      }
    }
    return result;
  }

  private normalize(artifact: VersionedArtifact, file: string, to: number, dryRun: boolean, result: MigrationResult): MigrationAction {
    const action: MigrationAction = {
      artifact, file, fromVersion: null, toVersion: to, kind: "normalize-legacy", applied: false,
      note: dryRun ? `would stamp schemaVersion=${to}` : `stamped schemaVersion=${to}`,
    };
    if (dryRun) return action;

    const path = this.files.p(artifact);
    let next: string | null = null;
    try {
      const raw = fs.readFileSync(path, "utf8");
      next = artifact === "checkpoints" ? this.stampJsonl(raw, to) : this.stampJson(raw, to);
    } catch (e: any) {
      action.note = `failed to read: ${e?.message ?? e}`;
      return action;
    }
    if (next === null) { action.note = "could not normalize (unparseable)"; return action; }

    const backup = `${path}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`;
    fs.copyFileSync(path, backup);
    fs.writeFileSync(path, next, "utf8");
    result.backups.push(backup);
    action.applied = true;
    return action;
  }

  private stampJson(raw: string, to: number): string | null {
    try {
      const obj = JSON.parse(raw);
      if (typeof obj !== "object" || obj === null) return null;
      obj.schemaVersion = to;
      return JSON.stringify(obj, null, 2) + "\n";
    } catch { return null; }
  }

  private stampJsonl(raw: string, to: number): string | null {
    const out: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed);
        if (typeof obj.schemaVersion !== "number") obj.schemaVersion = to;
        out.push(JSON.stringify(obj));
      } catch { return null; }
    }
    return out.join("\n") + "\n";
  }
}
