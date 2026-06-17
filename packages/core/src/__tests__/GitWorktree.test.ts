import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { GitService } from "../git/GitService";

function git(cwd: string, args: string) {
  execSync(`git ${args}`, { cwd, stdio: "ignore" });
}

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-wt-"));
  git(dir, "init -q");
  git(dir, "config user.email t@t.t");
  git(dir, "config user.name t");
  git(dir, "commit -q --allow-empty -m init");
  return dir;
}

describe("GitService worktrees (v2.6)", () => {
  let repo: string;
  beforeAll(() => { repo = makeRepo(); });

  it("adds, lists, and removes a worktree", () => {
    const gs = new GitService(repo);
    const wt = path.join(os.tmpdir(), `rb-wt-out-${Date.now()}`);

    const add = gs.addWorktree(wt, "relay/feature");
    expect(add.ok).toBe(true);
    expect(fs.existsSync(wt)).toBe(true);

    const list = gs.listWorktrees().map(p => fs.realpathSync(p));
    expect(list).toContain(fs.realpathSync(wt));
    // the worktree is itself a git work tree
    expect(new GitService(wt).isGitRepo()).toBe(true);

    const rm = gs.removeWorktree(wt, true);
    expect(rm.ok).toBe(true);
    expect(fs.existsSync(wt)).toBe(false);
  });

  it("reports an error instead of throwing when add fails", () => {
    const gs = new GitService(repo);
    const wt = path.join(os.tmpdir(), `rb-wt-dup-${Date.now()}`);
    expect(gs.addWorktree(wt, "relay/dup").ok).toBe(true);
    // same branch again → git refuses
    const second = gs.addWorktree(path.join(os.tmpdir(), `rb-wt-dup2-${Date.now()}`), "relay/dup");
    expect(second.ok).toBe(false);
    expect(second.error).toBeTruthy();
    gs.removeWorktree(wt, true);
  });
});
