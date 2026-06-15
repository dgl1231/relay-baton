import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { HandoffBundleManifest, HandoffBundleGit } from "./HandoffBundler";

const DEFAULT_BUNDLE_ROOT = path.join(os.homedir(), ".relay-baton", "handoff-bundles");

export interface InspectedBundleFile {
  target: string;
  size: number;
  sha256: string;
  present: boolean;
  sizeMatches: boolean;
  hashMatches: boolean;
}

export interface HandoffBundleInspectResult {
  available: boolean;
  id: string | null;
  bundleDir: string | null;
  createdAt: string | null;
  repoRoot: string | null;
  git: HandoffBundleGit | null;
  fileCount: number;
  totalBytes: number;
  files: InspectedBundleFile[];
  missing: string[];
  corrupt: string[];
  intact: boolean;
  redactionFindings: number | null;
  reason?: string;
}

export interface HandoffBundleInspectorOptions {
  bundleRoot?: string;
}

/**
 * Validate and describe a handoff bundle without applying anything. Read-only:
 * checks manifest shape and per-file integrity (presence + size + SHA-256).
 */
export class HandoffBundleInspector {
  private readonly bundleRoot: string;
  constructor(options: HandoffBundleInspectorOptions = {}) {
    this.bundleRoot = options.bundleRoot ?? DEFAULT_BUNDLE_ROOT;
  }

  inspect(idOrPath: string): HandoffBundleInspectResult {
    const bundleDir = path.isAbsolute(idOrPath) ? idOrPath : path.join(this.bundleRoot, idOrPath);
    const id = path.basename(bundleDir);
    const empty: HandoffBundleInspectResult = {
      available: false, id: null, bundleDir: null, createdAt: null, repoRoot: null, git: null,
      fileCount: 0, totalBytes: 0, files: [], missing: [], corrupt: [], intact: false, redactionFindings: null,
    };

    if (!fs.existsSync(bundleDir) || !fs.statSync(bundleDir).isDirectory()) {
      return { ...empty, reason: "bundle not found" };
    }
    const manifest = this.readManifest(bundleDir);
    if (!manifest) return { ...empty, id, bundleDir, reason: "manifest.json missing or invalid" };

    const files: InspectedBundleFile[] = [];
    const missing: string[] = [];
    const corrupt: string[] = [];
    let totalBytes = 0;
    for (const f of manifest.files) {
      const abs = path.isAbsolute(f.target) ? f.target : path.join(bundleDir, f.target);
      const present = fs.existsSync(abs) && fs.statSync(abs).isFile();
      let sizeMatches = false;
      let hashMatches = false;
      if (present) {
        const bytes = fs.readFileSync(abs);
        sizeMatches = bytes.length === f.size;
        hashMatches = crypto.createHash("sha256").update(bytes).digest("hex") === f.sha256;
      }
      totalBytes += f.size;
      const rel = path.relative(bundleDir, abs);
      if (!present) missing.push(rel);
      else if (!sizeMatches || !hashMatches) corrupt.push(rel);
      files.push({ target: rel, size: f.size, sha256: f.sha256, present, sizeMatches, hashMatches });
    }

    return {
      available: true,
      id,
      bundleDir,
      createdAt: manifest.createdAt ?? null,
      repoRoot: manifest.repoRoot ?? null,
      git: manifest.git ?? null,
      fileCount: manifest.files.length,
      totalBytes,
      files,
      missing,
      corrupt,
      intact: missing.length === 0 && corrupt.length === 0,
      redactionFindings: this.readRedactionCount(bundleDir),
    };
  }

  private readManifest(bundleDir: string): HandoffBundleManifest | null {
    const p = path.join(bundleDir, "manifest.json");
    if (!fs.existsSync(p)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(p, "utf8")) as HandoffBundleManifest;
      if (!parsed || !Array.isArray(parsed.files)) return null;
      return parsed;
    } catch { return null; }
  }

  private readRedactionCount(bundleDir: string): number | null {
    const p = path.join(bundleDir, "redaction.json");
    if (!fs.existsSync(p)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
      return Array.isArray(parsed?.findings) ? parsed.findings.length : null;
    } catch { return null; }
  }
}
