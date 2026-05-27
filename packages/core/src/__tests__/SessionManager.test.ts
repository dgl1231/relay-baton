import { describe, it, expect } from "vitest";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { SessionManager } from "../session/SessionManager";
import { defaultConfig } from "../config/defaultConfig";

describe("SessionManager.init", () => {
  it("creates .ai-session with required files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-"));
    const sm = new SessionManager(dir, defaultConfig);
    const r = sm.init("do thing");
    expect(r.created).toBe(true);
    expect(fs.existsSync(sm.files.p("sessionJson"))).toBe(true);
    expect(fs.existsSync(sm.files.p("task"))).toBe(true);
    expect(fs.existsSync(sm.files.p("commandsLog"))).toBe(true);
    const meta = sm.getMeta();
    expect(meta?.status).toBe("initialized");
    expect(meta?.primaryAgent).toBe("codex");
  });
  it("is idempotent", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-"));
    const sm = new SessionManager(dir, defaultConfig);
    sm.init("a");
    const r2 = sm.init("b");
    expect(r2.alreadyExisted).toBe(true);
  });
});
