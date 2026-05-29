import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager } from "../session/SessionManager";
import { ConversationLog } from "../conversation/ConversationLog";
import { defaultConfig } from "../config/defaultConfig";

function setup(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-conv-"));
  const sm = new SessionManager(dir, defaultConfig);
  sm.init("conv test");
  return dir;
}

describe("ConversationLog", () => {
  it("appends events as JSONL and reads them back in order", () => {
    const dir = setup();
    const log = new ConversationLog(dir);
    const a = log.append({ role: "user", kind: "message", text: "hi" });
    log.append({ role: "relay-baton", kind: "review", text: "summary", refs: { plan: "plan.md" } });

    const events = log.read();
    expect(events).toHaveLength(2);
    expect(events[0].id).toBe(a.id);
    expect(events[0].role).toBe("user");
    expect(events[1].kind).toBe("review");
    expect(events[1].refs?.plan).toBe("plan.md");
    expect(events[0].id).toMatch(/^evt_/);
    expect(events[0].ts).toMatch(/T/);
  });

  it("returns [] when no log file exists", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-conv-empty-"));
    expect(new ConversationLog(dir).read()).toEqual([]);
  });

  it("skips malformed lines defensively", () => {
    const dir = setup();
    const log = new ConversationLog(dir);
    log.append({ role: "user", kind: "message", text: "ok" });
    const p = path.join(dir, ".ai-session", "conversation.jsonl");
    fs.appendFileSync(p, "this is not json\n");
    const events = log.read();
    expect(events).toHaveLength(1);
  });
});
