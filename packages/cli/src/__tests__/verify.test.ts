import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { verifyCommand } from "../commands/verify";

function mkGitRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-verify-"));
  spawnSync("git", ["init"], { cwd: dir, stdio: "ignore" });
  return dir;
}

describe("verifyCommand", () => {
  let dir: string;
  let logs: string[];
  let savedCwd: string;
  let savedExitCode: typeof process.exitCode;

  beforeEach(() => {
    dir = mkGitRepo();
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...a: any[]) => { logs.push(a.map(String).join(" ")); });
    savedCwd = process.cwd();
    savedExitCode = process.exitCode;
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(savedCwd);
    process.exitCode = savedExitCode;
    vi.restoreAllMocks();
  });

  it("passes the simulated pipeline without real model calls and exits 0", async () => {
    await verifyCommand({});
    const out = logs.join("\n");
    expect(out).toMatch(/fallback detection/);
    expect(out).toMatch(/handoff \(no-run\)/);
    expect(out).toMatch(/api-key env block/);
    expect(out).toMatch(/verify passed/);
    expect(process.exitCode === 0 || process.exitCode === undefined).toBe(true);
  });

  it("does not write a handoff into the current working directory's .ai-session", async () => {
    await verifyCommand({ diet: "caveman" });
    // The simulation uses a throwaway temp repo, not the cwd.
    expect(fs.existsSync(path.join(dir, ".ai-session", "handoff.md"))).toBe(false);
  });

  it("treats --real-agents as non-executing scaffold only", async () => {
    await verifyCommand({ realAgents: true });
    const out = logs.join("\n");
    expect(out).toMatch(/experimental|NOT executed/i);
    expect(out).toMatch(/verify passed/);
  });
});
