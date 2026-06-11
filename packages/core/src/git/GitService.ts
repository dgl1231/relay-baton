import { execSync, spawnSync } from "child_process";

export interface GitFileSummary {
  path: string;
  code: string;
  label: string;
}

export interface GitSummary {
  available: boolean;
  branch: string | null;
  head: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  clean: boolean;
  changed: number;
  staged: number;
  unstaged: number;
  untracked: number;
  files: GitFileSummary[];
  diffStat: string;
}

export interface GitBaseline {
  createdAt: string;
  available: boolean;
  branch: string | null;
  head: string | null;
  clean: boolean;
  changed: number;
}

export interface GitBaselineComparison {
  baseline: GitBaseline | null;
  changedSinceBaseline: boolean | null;
  headChanged: boolean | null;
  branchChanged: boolean | null;
  dirtyChanged: boolean | null;
  changedDelta: number | null;
}

export class GitService {
  constructor(private repoRoot: string) {}

  isGitRepo(): boolean {
    const r = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: this.repoRoot,
      encoding: "utf8",
    });
    return r.status === 0 && r.stdout.trim() === "true";
  }

  status(): string {
    return this.safe(["status", "--short", "--branch"]);
  }

  summary(limit = 40): GitSummary {
    if (!this.isGitRepo()) {
      return {
        available: false,
        branch: null,
        head: null,
        upstream: null,
        ahead: 0,
        behind: 0,
        clean: true,
        changed: 0,
        staged: 0,
        unstaged: 0,
        untracked: 0,
        files: [],
        diffStat: "",
      };
    }

    const head = this.safe(["rev-parse", "HEAD"]).trim() || null;
    const branch = this.safe(["branch", "--show-current"]).trim() || (head ? this.safe(["rev-parse", "--short", "HEAD"]).trim() : "") || null;
    const upstream = this.safe(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]).trim() || null;
    const counts = this.aheadBehind(upstream);
    const allFiles = this.statusFiles();
    const files = allFiles.slice(0, Math.max(0, limit));
    const staged = allFiles.filter(f => f.code[0] !== " " && f.code[0] !== "?").length;
    const unstaged = allFiles.filter(f => f.code[1] !== " " && f.code[1] !== "?" && f.code[1] !== undefined).length;
    const untracked = allFiles.filter(f => f.code === "??").length;

    return {
      available: true,
      branch,
      head,
      upstream,
      ahead: counts.ahead,
      behind: counts.behind,
      clean: allFiles.length === 0,
      changed: allFiles.length,
      staged,
      unstaged,
      untracked,
      files,
      diffStat: this.diffNameStat(),
    };
  }

  changedFiles(): string[] {
    const out = this.safe(["diff", "--name-only", "HEAD"]);
    const untracked = this.safe(["ls-files", "--others", "--exclude-standard"]);
    return [...new Set([...out.split("\n"), ...untracked.split("\n")])].map(s => s.trim()).filter(Boolean);
  }

  diff(): string {
    return this.safe(["diff", "HEAD"]);
  }

  diffNameStat(): string {
    return this.safe(["diff", "--stat", "HEAD"]);
  }

  baselineSnapshot(now = new Date()): GitBaseline {
    const s = this.summary(0);
    return {
      createdAt: now.toISOString(),
      available: s.available,
      branch: s.branch,
      head: s.head,
      clean: s.clean,
      changed: s.changed,
    };
  }

  compareBaseline(baseline: GitBaseline | null): GitBaselineComparison {
    if (!baseline) {
      return {
        baseline: null,
        changedSinceBaseline: null,
        headChanged: null,
        branchChanged: null,
        dirtyChanged: null,
        changedDelta: null,
      };
    }

    const current = this.baselineSnapshot();
    const headChanged = baseline.head !== current.head;
    const branchChanged = baseline.branch !== current.branch;
    const dirtyChanged = baseline.clean !== current.clean || baseline.changed !== current.changed;
    return {
      baseline,
      changedSinceBaseline: headChanged || branchChanged || dirtyChanged,
      headChanged,
      branchChanged,
      dirtyChanged,
      changedDelta: current.changed - baseline.changed,
    };
  }

  private aheadBehind(upstream: string | null): { ahead: number; behind: number } {
    if (!upstream) return { ahead: 0, behind: 0 };
    const out = this.safe(["rev-list", "--left-right", "--count", `${upstream}...HEAD`]).trim();
    const [behindRaw, aheadRaw] = out.split(/\s+/);
    return {
      ahead: Number.parseInt(aheadRaw || "0", 10) || 0,
      behind: Number.parseInt(behindRaw || "0", 10) || 0,
    };
  }

  private statusFiles(): GitFileSummary[] {
    const out = this.safe(["status", "--porcelain=v1"]);
    return out.split("\n")
      .map(line => line.trimEnd())
      .filter(Boolean)
      .map(line => {
        const code = line.slice(0, 2);
        const rawPath = line.slice(3);
        return { path: rawPath, code, label: this.statusLabel(code) };
      });
  }

  private statusLabel(code: string): string {
    if (code === "??") return "untracked";
    if (code === "!!") return "ignored";
    const index = code[0];
    const worktree = code[1];
    if (index !== " " && worktree !== " ") return "staged + unstaged";
    if (index !== " ") return "staged";
    if (worktree !== " ") return "unstaged";
    return "changed";
  }

  private safe(args: string[]): string {
    try {
      return execSync(`git ${args.map(a => JSON.stringify(a)).join(" ")}`, {
        cwd: this.repoRoot,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      return "";
    }
  }
}
