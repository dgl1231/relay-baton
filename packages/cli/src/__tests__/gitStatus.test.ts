import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { SessionManager, defaultConfig } from "@relay-baton/core";
import { gitStatusCommand } from "../commands/git";

describe("git status command", () => {
  let logs: string[];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.map(a => String(a)).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits a read-only JSON summary for a git project", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-gitstatus-repo-"));
    spawnSync("git", ["init"], { cwd: repo });
    fs.writeFileSync(path.join(repo, "note.txt"), "hello\n", "utf8");
    fs.writeFileSync(path.join(repo, "other.txt"), "hello\n", "utf8");

    await gitStatusCommand({ path: repo, json: true, limit: "1" });

    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.repoRoot).toBe(path.resolve(repo));
    expect(parsed.available).toBe(true);
    expect(parsed.changed).toBe(2);
    expect(parsed.untracked).toBe(2);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]).toMatchObject({ path: "note.txt", code: "??", label: "untracked" });
  });

  it("reports available=false for a non-git project", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-gitstatus-folder-"));

    await gitStatusCommand({ path: dir, json: true });

    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.repoRoot).toBe(path.resolve(dir));
    expect(parsed.available).toBe(false);
    expect(parsed.changed).toBe(0);
    expect(parsed.files).toEqual([]);
  });

  it("reports whether the repo changed since the session baseline", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-gitstatus-baseline-"));
    spawnSync("git", ["init"], { cwd: repo });
    fs.writeFileSync(path.join(repo, "before.txt"), "before\n", "utf8");
    new SessionManager(repo, defaultConfig).init("track git");
    fs.writeFileSync(path.join(repo, "after.txt"), "after\n", "utf8");

    await gitStatusCommand({ path: repo, json: true });

    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.tracking.baseline).toBeTruthy();
    expect(parsed.tracking.changedSinceBaseline).toBe(true);
    expect(parsed.tracking.changedDelta).toBe(1);
  });
});
