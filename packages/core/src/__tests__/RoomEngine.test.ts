import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager } from "../session/SessionManager";
import { defaultConfig } from "../config/defaultConfig";
import { RoomEngine } from "../room/RoomEngine";
import { parseSlash, parseAgentArg } from "../room/RoomCommands";
import { ConversationLog } from "../conversation/ConversationLog";

function setup(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-room-"));
  const sm = new SessionManager(dir, defaultConfig);
  sm.init("room test");
  return dir;
}

describe("parseSlash", () => {
  it("parses known commands and their args", () => {
    expect(parseSlash("/plan add a feature")).toEqual({ name: "plan", args: "add a feature" });
    expect(parseSlash("  /review  ")).toEqual({ name: "review", args: "" });
    expect(parseSlash("/AGENT codex")).toEqual({ name: "agent", args: "codex" });
  });
  it("returns null for plain messages and unknown commands", () => {
    expect(parseSlash("hello there")).toBeNull();
    expect(parseSlash("/bogus")).toBeNull();
  });
});

describe("parseAgentArg", () => {
  it("accepts claude/codex case-insensitively, rejects others", () => {
    expect(parseAgentArg("Claude")).toBe("claude");
    expect(parseAgentArg("CODEX")).toBe("codex");
    expect(parseAgentArg("gemini")).toBeNull();
    expect(parseAgentArg("")).toBeNull();
  });
});

describe("RoomEngine", () => {
  it("logs a plain message as a user conversation event addressed to the current agent", () => {
    const dir = setup();
    const e = new RoomEngine(dir, "sess-1", "claude");
    const a = e.handle("please plan the refactor");
    expect(a).toEqual({ kind: "chat", agent: "claude", text: "please plan the refactor" });
    const events = new ConversationLog(dir).read();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ role: "user", kind: "message", text: "please plan the refactor" });
    expect(events[0].meta?.agent).toBe("claude");
  });

  it("switches the addressed agent and records a status event", () => {
    const dir = setup();
    const e = new RoomEngine(dir, "sess-1", "claude");
    expect(e.handle("/agent codex")).toEqual({ kind: "switch-agent", agent: "codex" });
    expect(e.currentAgent).toBe("codex");
    const events = new ConversationLog(dir).read();
    expect(events.at(-1)).toMatchObject({ role: "relay-baton", kind: "status" });
  });

  it("requires confirmation for real agent runs but not for read-only commands", () => {
    const dir = setup();
    const e = new RoomEngine(dir, "sess-1", "codex");
    const plan = e.handle("/plan do the thing");
    expect(plan).toMatchObject({ kind: "run", command: "plan", args: "do the thing", agent: "codex", requiresConfirmation: true });
    expect(e.handle("/review")).toMatchObject({ kind: "run", command: "review", requiresConfirmation: false });
    expect(e.handle("/status")).toMatchObject({ kind: "run", command: "status", requiresConfirmation: false });
    expect(e.handle("/budget")).toMatchObject({ kind: "run", command: "budget", requiresConfirmation: false });
    expect(e.handle("/execute")).toMatchObject({ kind: "run", command: "execute", requiresConfirmation: true });
    expect(e.handle("/handoff")).toMatchObject({ kind: "run", command: "handoff", requiresConfirmation: true });
  });

  it("errors on /plan without a task, /agent without a valid id, and unknown commands", () => {
    const dir = setup();
    const e = new RoomEngine(dir);
    expect(e.handle("/plan").kind).toBe("error");
    expect(e.handle("/agent gemini").kind).toBe("error");
    expect(e.handle("/nope").kind).toBe("error");
  });

  it("handles /help, /exit and empty input", () => {
    const dir = setup();
    const e = new RoomEngine(dir);
    expect(e.handle("/help").kind).toBe("help");
    expect(e.handle("/exit")).toEqual({ kind: "exit" });
    expect(e.handle("   ")).toEqual({ kind: "noop" });
  });
});
