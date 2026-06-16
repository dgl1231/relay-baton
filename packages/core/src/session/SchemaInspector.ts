import * as fs from "fs";
import { ARTIFACT_SCHEMA_VERSIONS, SESSION_FILES, type VersionedArtifact } from "@relay-baton/shared";
import { SessionFiles } from "./SessionFiles";

export type SchemaStatus = "ok" | "outdated" | "ahead" | "legacy" | "absent" | "unreadable";

export interface SchemaArtifactCheck {
  artifact: VersionedArtifact;
  file: string;
  present: boolean;
  foundVersion: number | null;
  currentVersion: number;
  status: SchemaStatus;
  guidance: string;
}

export interface SchemaReport {
  sessionDir: string;
  exists: boolean;
  /** true when nothing is outdated/ahead/unreadable (legacy/absent are fine). */
  ok: boolean;
  /** true when at least one artifact would benefit from migration. */
  migratable: boolean;
  checks: SchemaArtifactCheck[];
}

/**
 * Detects the on-disk schema version of each versioned `.ai-session` artifact
 * and compares it against the current contract. Read-only and deterministic —
 * it reports and guides; it never rewrites artifacts. The actual migrators plug
 * in here when a schema version is bumped.
 */
export class SchemaInspector {
  private files: SessionFiles;
  constructor(repoRoot: string) {
    this.files = new SessionFiles(repoRoot);
  }

  inspect(): SchemaReport {
    const exists = fs.existsSync(this.files.dir);
    if (!exists) {
      return { sessionDir: this.files.dir, exists: false, ok: true, migratable: false, checks: [] };
    }

    const checks: SchemaArtifactCheck[] = [
      this.checkJson("sessionJson"),
      this.checkJson("gitBaseline"),
      this.checkJsonl("checkpoints"),
      this.checkJsonl("conversation"),
    ];

    const ok = checks.every(c => c.status !== "outdated" && c.status !== "ahead" && c.status !== "unreadable");
    const migratable = checks.some(c => c.status === "outdated" || c.status === "legacy");
    return { sessionDir: this.files.dir, exists: true, ok, migratable, checks };
  }

  private checkJson(artifact: VersionedArtifact): SchemaArtifactCheck {
    const file = SESSION_FILES[artifact];
    const current = ARTIFACT_SCHEMA_VERSIONS[artifact];
    const raw = this.read(artifact);
    if (raw === null) return this.absent(artifact, file, current);
    try {
      const parsed = JSON.parse(raw);
      const found = typeof parsed?.schemaVersion === "number" ? parsed.schemaVersion : null;
      return this.classify(artifact, file, found, current);
    } catch {
      return { artifact, file, present: true, foundVersion: null, currentVersion: current, status: "unreadable", guidance: "unparseable JSON — re-run `relay-baton init` or restore from a session archive" };
    }
  }

  private checkJsonl(artifact: VersionedArtifact): SchemaArtifactCheck {
    const file = SESSION_FILES[artifact];
    const current = ARTIFACT_SCHEMA_VERSIONS[artifact];
    const raw = this.read(artifact);
    if (raw === null) return this.absent(artifact, file, current);
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return this.absent(artifact, file, current);
    // Take the max schemaVersion seen across lines; unreadable if any line is bad JSON.
    let found: number | null = null;
    for (const l of lines) {
      try {
        const v = JSON.parse(l)?.schemaVersion;
        if (typeof v === "number") found = found === null ? v : Math.max(found, v);
      } catch {
        return { artifact, file, present: true, foundVersion: null, currentVersion: current, status: "unreadable", guidance: "contains malformed JSON line(s)" };
      }
    }
    return this.classify(artifact, file, found, current);
  }

  private classify(artifact: VersionedArtifact, file: string, found: number | null, current: number): SchemaArtifactCheck {
    if (found === null) {
      return { artifact, file, present: true, foundVersion: null, currentVersion: current, status: "legacy", guidance: `no schemaVersion field — treated as v1; will normalize to v${current} on migrate` };
    }
    if (found === current) {
      return { artifact, file, present: true, foundVersion: found, currentVersion: current, status: "ok", guidance: "up to date" };
    }
    if (found < current) {
      return { artifact, file, present: true, foundVersion: found, currentVersion: current, status: "outdated", guidance: `written as v${found}; run \`relay-baton migrate\` to update to v${current}` };
    }
    return { artifact, file, present: true, foundVersion: found, currentVersion: current, status: "ahead", guidance: `written as v${found} by a newer relay-baton; upgrade the CLI to read it safely` };
  }

  private absent(artifact: VersionedArtifact, file: string, current: number): SchemaArtifactCheck {
    return { artifact, file, present: false, foundVersion: null, currentVersion: current, status: "absent", guidance: "not present" };
  }

  private read(artifact: VersionedArtifact): string | null {
    try { return fs.readFileSync(this.files.p(artifact), "utf8"); } catch { return null; }
  }
}
