import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SESSION_DIR } from "@relay-baton/shared";
import { WorkspaceManager, isValidSessionName } from "../session/WorkspaceManager";
import { SessionFiles } from "../session/SessionFiles";

function repo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rb-ws-"));
}

describe("WorkspaceManager (v2.6)", () => {
  it("defaults to the `default` session with no workspace file", () => {
    const r = repo();
    expect(WorkspaceManager.activeName(r)).toBe("default");
    expect(new WorkspaceManager(r).list().map(s => s.name)).toEqual(["default"]);
  });

  it("resolves default to the legacy flat dir and named to sessions/<name>", () => {
    const r = repo();
    expect(WorkspaceManager.resolveSessionDir(r, "default")).toBe(path.join(r, SESSION_DIR));
    expect(WorkspaceManager.resolveSessionDir(r, "feature-x")).toBe(path.join(r, SESSION_DIR, "sessions", "feature-x"));
  });

  it("creates, lists (default first), switches, and resolves active", () => {
    const r = repo();
    const wm = new WorkspaceManager(r);
    wm.create("auth", { assignedAgent: "codex" });
    wm.create("docs", { activate: true });

    expect(wm.list().map(s => s.name)).toEqual(["default", "auth", "docs"]);
    expect(wm.activeName()).toBe("docs");
    expect(WorkspaceManager.activeName(r)).toBe("docs");
    // SessionFiles follows the active work item.
    expect(new SessionFiles(r).dir).toBe(path.join(r, SESSION_DIR, "sessions", "docs"));
    expect(fs.existsSync(path.join(r, SESSION_DIR, "sessions", "auth"))).toBe(true);

    wm.switchTo("default");
    expect(new SessionFiles(r).dir).toBe(path.join(r, SESSION_DIR));
    expect(wm.load().sessions.find(s => s.name === "auth")?.assignedAgent).toBe("codex");
  });

  it("rejects duplicate, reserved, and invalid names", () => {
    const r = repo();
    const wm = new WorkspaceManager(r);
    wm.create("x");
    expect(() => wm.create("x")).toThrow(/already exists/);
    expect(() => wm.create("default")).toThrow();
    expect(() => wm.switchTo("nope")).toThrow(/unknown session/);
    expect(isValidSessionName("good-1")).toBe(true);
    expect(isValidSessionName("bad/name")).toBe(false);
    expect(isValidSessionName("sessions")).toBe(false);
  });

  it("removes named items (never default) and resets active to default", () => {
    const r = repo();
    const wm = new WorkspaceManager(r);
    wm.create("temp", { activate: true });
    expect(wm.activeName()).toBe("temp");
    wm.remove("temp", { deleteFiles: true });
    expect(wm.activeName()).toBe("default");
    expect(wm.list().map(s => s.name)).toEqual(["default"]);
    expect(() => wm.remove("default")).toThrow(/cannot remove/);
  });

  it("assigns and clears an agent", () => {
    const r = repo();
    const wm = new WorkspaceManager(r);
    wm.create("a");
    wm.assignAgent("a", "claude");
    expect(wm.load().sessions.find(s => s.name === "a")?.assignedAgent).toBe("claude");
    wm.assignAgent("a", undefined);
    expect(wm.load().sessions.find(s => s.name === "a")?.assignedAgent).toBeUndefined();
  });
});
