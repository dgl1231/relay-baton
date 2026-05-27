import { execSync, spawnSync } from "child_process";

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

  private safe(args: string[]): string {
    try {
      return execSync(`git ${args.map(a => JSON.stringify(a)).join(" ")}`, {
        cwd: this.repoRoot,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      });
    } catch {
      return "";
    }
  }
}
