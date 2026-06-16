import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SESSION_DIR } from "@relay-baton/shared";

const DEFAULT_ARCHIVE_ROOT = path.join(os.homedir(), ".relay-baton", "session-archives");

export interface ArchivedFile {
  source: string;
  target: string;
  size: number;
  sha256: string;
}

export interface SessionArchiveManifest {
  schemaVersion: 1;
  createdAt: string;
  repoRoot: string;
  sessionDir: string;
  archiveDir: string;
  files: ArchivedFile[];
}

export interface SessionArchiveOptions {
  archiveRoot?: string;
  dryRun?: boolean;
  now?: Date;
}

export interface SessionArchiveResult {
  available: boolean;
  dryRun: boolean;
  archiveDir: string | null;
  manifest: SessionArchiveManifest | null;
  reason?: string;
}

export class SessionArchiver {
  constructor(private readonly repoRoot: string) {}

  archive(options: SessionArchiveOptions = {}): SessionArchiveResult {
    const sessionDir = path.join(this.repoRoot, SESSION_DIR);
    const dryRun = options.dryRun === true;
    if (!fs.existsSync(sessionDir) || !fs.statSync(sessionDir).isDirectory()) {
      return {
        available: false,
        dryRun,
        archiveDir: null,
        manifest: null,
        reason: `${SESSION_DIR} not found`,
      };
    }

    const now = options.now ?? new Date();
    const archiveRoot = options.archiveRoot ?? DEFAULT_ARCHIVE_ROOT;
    const archiveDir = path.join(
      archiveRoot,
      `${this.safeName(path.basename(this.repoRoot) || "repo")}-${now.toISOString().replace(/[:.]/g, "-")}`,
    );

    const files = this.collectFiles(sessionDir, archiveDir);
    const manifest: SessionArchiveManifest = {
      schemaVersion: 1,
      createdAt: now.toISOString(),
      repoRoot: this.repoRoot,
      sessionDir,
      archiveDir,
      files,
    };

    if (!dryRun) {
      fs.mkdirSync(archiveDir, { recursive: true });
      for (const f of files) {
        const dest = path.join(archiveDir, f.target);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(f.source, dest);
      }
      fs.writeFileSync(path.join(archiveDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    }

    return { available: true, dryRun, archiveDir, manifest };
  }

  private collectFiles(sessionDir: string, archiveDir: string): ArchivedFile[] {
    const out: ArchivedFile[] = [];
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir).sort()) {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          walk(full);
          continue;
        }
        if (!stat.isFile()) continue;
        const rel = path.relative(sessionDir, full);
        const bytes = fs.readFileSync(full);
        out.push({
          source: full,
          // Archive-relative (POSIX) target — portable and traversal-safe on
          // the receiving side (v2.2 path-traversal guard).
          target: rel.split(path.sep).join("/"),
          size: stat.size,
          sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        });
      }
    };
    walk(sessionDir);
    return out;
  }

  private safeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "repo";
  }
}
