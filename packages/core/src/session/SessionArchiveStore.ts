import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { SessionArchiveManifest } from "./SessionArchiver";

export const DEFAULT_ARCHIVE_ROOT = path.join(os.homedir(), ".relay-baton", "session-archives");

export interface SessionArchiveSummary {
  id: string;
  archiveDir: string;
  createdAt: string | null;
  repoRoot: string | null;
  fileCount: number;
  totalBytes: number;
  valid: boolean;
  reason?: string;
}

export interface SessionArchiveListResult {
  available: boolean;
  archiveRoot: string;
  archives: SessionArchiveSummary[];
  reason?: string;
}

export interface InspectedFile {
  target: string;
  size: number;
  sha256: string;
  present: boolean;
  sizeMatches: boolean;
  hashMatches: boolean;
}

export interface SessionArchiveInspectResult {
  available: boolean;
  id: string | null;
  archiveDir: string | null;
  createdAt: string | null;
  repoRoot: string | null;
  fileCount: number;
  totalBytes: number;
  files: InspectedFile[];
  missing: string[];
  corrupt: string[];
  intact: boolean;
  reason?: string;
}

export interface SessionArchiveStoreOptions {
  archiveRoot?: string;
}

export class SessionArchiveStore {
  private readonly archiveRoot: string;

  constructor(options: SessionArchiveStoreOptions = {}) {
    this.archiveRoot = options.archiveRoot ?? DEFAULT_ARCHIVE_ROOT;
  }

  list(): SessionArchiveListResult {
    if (!fs.existsSync(this.archiveRoot) || !fs.statSync(this.archiveRoot).isDirectory()) {
      return {
        available: false,
        archiveRoot: this.archiveRoot,
        archives: [],
        reason: "archive root not found",
      };
    }

    const archives: SessionArchiveSummary[] = [];
    for (const name of fs.readdirSync(this.archiveRoot)) {
      const archiveDir = path.join(this.archiveRoot, name);
      if (!fs.statSync(archiveDir).isDirectory()) continue;
      archives.push(this.summarize(name, archiveDir));
    }

    archives.sort((a, b) => {
      const ta = a.createdAt ?? "";
      const tb = b.createdAt ?? "";
      if (ta === tb) return b.id.localeCompare(a.id);
      return tb.localeCompare(ta);
    });

    return { available: true, archiveRoot: this.archiveRoot, archives };
  }

  inspect(idOrPath: string): SessionArchiveInspectResult {
    const archiveDir = path.isAbsolute(idOrPath) ? idOrPath : path.join(this.archiveRoot, idOrPath);
    const id = path.basename(archiveDir);
    const empty: SessionArchiveInspectResult = {
      available: false,
      id: null,
      archiveDir: null,
      createdAt: null,
      repoRoot: null,
      fileCount: 0,
      totalBytes: 0,
      files: [],
      missing: [],
      corrupt: [],
      intact: false,
    };

    if (!fs.existsSync(archiveDir) || !fs.statSync(archiveDir).isDirectory()) {
      return { ...empty, reason: "archive not found" };
    }

    const manifest = this.readManifest(archiveDir);
    if (!manifest) {
      return { ...empty, id, archiveDir, reason: "manifest.json missing or invalid" };
    }

    const files: InspectedFile[] = [];
    const missing: string[] = [];
    const corrupt: string[] = [];
    let totalBytes = 0;

    for (const f of manifest.files) {
      const abs = path.isAbsolute(f.target) ? f.target : path.join(archiveDir, f.target);
      const present = fs.existsSync(abs) && fs.statSync(abs).isFile();
      let sizeMatches = false;
      let hashMatches = false;
      if (present) {
        const bytes = fs.readFileSync(abs);
        sizeMatches = bytes.length === f.size;
        hashMatches = crypto.createHash("sha256").update(bytes).digest("hex") === f.sha256;
      }
      totalBytes += f.size;
      const rel = path.relative(archiveDir, abs);
      if (!present) missing.push(rel);
      else if (!sizeMatches || !hashMatches) corrupt.push(rel);
      files.push({ target: rel, size: f.size, sha256: f.sha256, present, sizeMatches, hashMatches });
    }

    return {
      available: true,
      id,
      archiveDir,
      createdAt: manifest.createdAt ?? null,
      repoRoot: manifest.repoRoot ?? null,
      fileCount: manifest.files.length,
      totalBytes,
      files,
      missing,
      corrupt,
      intact: missing.length === 0 && corrupt.length === 0,
    };
  }

  private summarize(id: string, archiveDir: string): SessionArchiveSummary {
    const manifest = this.readManifest(archiveDir);
    if (!manifest) {
      return {
        id,
        archiveDir,
        createdAt: null,
        repoRoot: null,
        fileCount: 0,
        totalBytes: 0,
        valid: false,
        reason: "manifest.json missing or invalid",
      };
    }
    const totalBytes = manifest.files.reduce((sum, f) => sum + (f.size ?? 0), 0);
    return {
      id,
      archiveDir,
      createdAt: manifest.createdAt ?? null,
      repoRoot: manifest.repoRoot ?? null,
      fileCount: manifest.files.length,
      totalBytes,
      valid: true,
    };
  }

  private readManifest(archiveDir: string): SessionArchiveManifest | null {
    const manifestPath = path.join(archiveDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as SessionArchiveManifest;
      if (!parsed || !Array.isArray(parsed.files)) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}
