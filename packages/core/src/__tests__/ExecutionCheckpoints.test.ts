import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig } from "../index";
import { ExecutionCheckpoints } from "../plan/ExecutionCheckpoints";

function repoWithSession(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-checkpoint-"));
  new SessionManager(repo, defaultConfig).init("checkpoint test");
  return repo;
}

describe("ExecutionCheckpoints", () => {
  it("appends a checkpoint with git and budget snapshots", () => {
    const repo = repoWithSession();
    const cp = new ExecutionCheckpoints(repo, defaultConfig).append({
      step: 1,
      command: "pnpm test",
      result: "ok",
      note: "first step",
    });
    expect(cp.schemaVersion).toBe(1);
    expect(cp.step).toBe(1);
    expect(cp.result).toBe("ok");
    expect(cp.git).toHaveProperty("changed");
    expect(cp.budget?.activeProfile).toBeTruthy();
  });

  it("is append-only and lists in order", () => {
    const repo = repoWithSession();
    const cps = new ExecutionCheckpoints(repo, defaultConfig);
    cps.append({ step: 1, result: "ok" });
    cps.append({ step: 2, result: "pending" });
    const list = cps.list();
    expect(list.map(c => c.step)).toEqual([1, 2]);
    expect(list.map(c => c.result)).toEqual(["ok", "pending"]);
  });

  it("returns empty when no checkpoints exist", () => {
    const repo = repoWithSession();
    expect(new ExecutionCheckpoints(repo, defaultConfig).list()).toEqual([]);
  });

  it("tolerates malformed lines", () => {
    const repo = repoWithSession();
    const cps = new ExecutionCheckpoints(repo, defaultConfig);
    cps.append({ step: 1, result: "ok" });
    fs.appendFileSync(path.join(repo, ".ai-session", "checkpoints.jsonl"), "not json\n");
    cps.append({ step: 2, result: "fail" });
    const list = cps.list();
    expect(list.map(c => c.step)).toEqual([1, 2]);
  });

  it("omits the budget snapshot when no config is given", () => {
    const repo = repoWithSession();
    const cp = new ExecutionCheckpoints(repo).append({ step: 1 });
    expect(cp.budget).toBeNull();
    expect(cp.result).toBe("pending");
  });

  it("summarizes checkpoints into a compact receipt", () => {
    const repo = repoWithSession();
    const cps = new ExecutionCheckpoints(repo, defaultConfig);
    cps.append({ step: 1, command: "a", result: "ok" });
    cps.append({ step: 2, command: "b", result: "fail" });
    cps.append({ step: 3, command: "c", result: "pending" });
    const s = cps.summarize();
    expect(s.total).toBe(3);
    expect(s.results).toEqual({ ok: 1, fail: 1, pending: 1 });
    expect(s.lastStep).toBe(3);
    expect(s.lastResult).toBe("pending");
    expect(s.lastCommand).toBe("c");
  });

  it("summarizes an empty checkpoint log", () => {
    const repo = repoWithSession();
    const s = new ExecutionCheckpoints(repo, defaultConfig).summarize();
    expect(s.total).toBe(0);
    expect(s.lastStep).toBeNull();
  });
});
