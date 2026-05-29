import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager } from "../session/SessionManager";
import { ConversationLog } from "../conversation/ConversationLog";
import { ConversationReplay } from "../conversation/ConversationReplay";
import { defaultConfig } from "../config/defaultConfig";

function setup(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-replay-"));
  const sm = new SessionManager(dir, defaultConfig);
  sm.init("replay test");
  return dir;
}

describe("ConversationReplay", () => {
  it("builds an ordered timeline with a deterministic summary", () => {
    const dir = setup();
    const log = new ConversationLog(dir);
    log.append({ role: "user", kind: "message", text: "do x", meta: { agent: "claude" } });
    log.append({ role: "claude", kind: "plan", text: "planned", sessionId: "s1" });
    log.append({ role: "codex", kind: "execute", text: "ran", meta: { confirmed: true } });

    const { entries, summary } = new ConversationReplay(dir).build();
    expect(entries).toHaveLength(3);
    expect(entries[0].index).toBe(1);
    expect(entries[0].agent).toBe("claude");
    expect(entries[2].confirmed).toBe(true);
    expect(summary.total).toBe(3);
    expect(summary.byRole.user).toBe(1);
    expect(summary.byKind.plan).toBe(1);
    expect(summary.firstTs).toBeDefined();
  });

  it("filters by sessionId and kind", () => {
    const dir = setup();
    const log = new ConversationLog(dir);
    log.append({ role: "user", kind: "message", text: "a", sessionId: "s1" });
    log.append({ role: "claude", kind: "plan", text: "b", sessionId: "s2" });
    log.append({ role: "user", kind: "message", text: "c", sessionId: "s2" });

    const r = new ConversationReplay(dir).build({ sessionId: "s2" });
    expect(r.entries).toHaveLength(2);
    const k = new ConversationReplay(dir).build({ kinds: ["plan"] });
    expect(k.entries).toHaveLength(1);
    expect(k.entries[0].text).toBe("b");
  });

  it("keeps the most recent entries when limited", () => {
    const dir = setup();
    const log = new ConversationLog(dir);
    log.append({ role: "user", kind: "message", text: "1" });
    log.append({ role: "user", kind: "message", text: "2" });
    log.append({ role: "user", kind: "message", text: "3" });
    const r = new ConversationReplay(dir).build({ limit: 2 });
    expect(r.entries.map((e) => e.text)).toEqual(["2", "3"]);
    expect(r.entries[0].index).toBe(1);
  });

  it("renders token-diet one-liners", () => {
    const dir = setup();
    new ConversationLog(dir).append({ role: "user", kind: "message", text: "hi", meta: { agent: "codex" } });
    const lines = new ConversationReplay(dir).renderLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("user/codex message: hi");
  });

  it("returns empty result when no log exists", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-replay-empty-"));
    const r = new ConversationReplay(dir).build();
    expect(r.entries).toEqual([]);
    expect(r.summary.total).toBe(0);
  });
});
