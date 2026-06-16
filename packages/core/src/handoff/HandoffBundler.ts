import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SESSION_DIR, SESSION_FILES } from "@relay-baton/shared";
import { GitService } from "../git/GitService";
import { RedactionScanner, type RedactionReport } from "./RedactionScanner";

const DEFAULT_BUNDLE_ROOT = path.join(os.homedir(), ".relay-baton", "handoff-bundles");

/** Curated, share-worthy artifacts — not the whole .ai-session tree. */
const BUNDLE_FILES: (keyof typeof SESSION_FILES)[] = [
  "handoff",
  "compactState",
  "repoMap",
  "plan",
  "decisions",
  "changedFiles",
  "testResults",
  "errors",
  "sessionJson",
];

export interface BundledFile {
  source: string;
  target: string;
  size: number;
  sha256: string;
}

export interface HandoffBundleGit {
  available: boolean;
  branch: string | null;
  head: string | null;
  clean: boolean;
  changed: number;
}

export interface HandoffBundleManifest {
  schemaVersion: 1;
  createdAt: string;
  repoRoot: string;
  bundleDir: string;
  git: HandoffBundleGit;
  files: BundledFile[];
}

export interface HandoffBundleOptions {
  bundleRoot?: string;
  dryRun?: boolean;
  now?: Date;
}

export interface HandoffBundleResult {
  available: boolean;
  dryRun: boolean;
  bundleDir: string | null;
  manifest: HandoffBundleManifest | null;
  redaction: RedactionReport | null;
  reason?: string;
}

/**
 * Build a small, portable handoff bundle from curated `.ai-session` artifacts
 * plus a git summary, ready to share with another human or local agent setup.
 * Deterministic and read-only against the source repo; writes only into the
 * bundle directory. No model calls.
 */
export class HandoffBundler {
  constructor(private readonly repoRoot: string) {}

  bundle(options: HandoffBundleOptions = {}): HandoffBundleResult {
    const sessionDir = path.join(this.repoRoot, SESSION_DIR);
    const dryRun = options.dryRun === true;
    const handoffPath = path.join(sessionDir, SESSION_FILES.handoff);
    if (!fs.existsSync(handoffPath)) {
      return { available: false, dryRun, bundleDir: null, manifest: null, redaction: null, reason: "handoff.md not found (run `relay-baton handoff` first)" };
    }

    const now = options.now ?? new Date();
    const bundleRoot = options.bundleRoot ?? DEFAULT_BUNDLE_ROOT;
    const bundleDir = path.join(
      bundleRoot,
      `${this.safeName(path.basename(this.repoRoot) || "repo")}-${now.toISOString().replace(/[:.]/g, "-")}`,
    );

    const git = this.gitSnapshot();
    const files: BundledFile[] = [];
    for (const key of BUNDLE_FILES) {
      const source = path.join(sessionDir, SESSION_FILES[key]);
      if (!fs.existsSync(source) || !fs.statSync(source).isFile()) continue;
      const bytes = fs.readFileSync(source);
      files.push({
        source,
        // Manifest targets are bundle-relative (POSIX) so they stay portable
        // and pass the v2.2 path-traversal guard on the receiving side.
        target: SESSION_FILES[key],
        size: bytes.length,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      });
    }

    const redaction = new RedactionScanner().scanFiles(files.map(f => f.source));

    const manifest: HandoffBundleManifest = {
      schemaVersion: 1,
      createdAt: now.toISOString(),
      repoRoot: this.repoRoot,
      bundleDir,
      git,
      files,
    };

    if (!dryRun) {
      fs.mkdirSync(bundleDir, { recursive: true });
      for (const f of files) fs.copyFileSync(f.source, path.join(bundleDir, f.target));
      fs.writeFileSync(path.join(bundleDir, "git-summary.json"), `${JSON.stringify(git, null, 2)}\n`, "utf8");
      fs.writeFileSync(path.join(bundleDir, "redaction.json"), `${JSON.stringify(redaction, null, 2)}\n`, "utf8");
      fs.writeFileSync(path.join(bundleDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    }

    return { available: true, dryRun, bundleDir, manifest, redaction };
  }

  private gitSnapshot(): HandoffBundleGit {
    const git = new GitService(this.repoRoot);
    if (!git.isGitRepo()) return { available: false, branch: null, head: null, clean: true, changed: 0 };
    const s = git.summary(0);
    return { available: true, branch: s.branch, head: s.head, clean: s.clean, changed: s.changed };
  }

  private safeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "repo";
  }
}
