import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig } from "@relay-baton/core";
import { conversationAppendCommand } from "../commands/conversation";

function setupSession(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-cli-conversation-"));
  new SessionManager(dir, defaultConfig).init("desktop composer");
  return dir;
}

describe("conversationAppendCommand", () => {
  let logs: string[];
  beforeEach(() => {
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...a: any[]) => {
      logs.push(a.map(String).join(" "));
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("appends a user message event and prints JSON", async () => {
    const dir = setupSession();
    await conversationAppendCommand("hello from desktop", { path: dir, json: true });

    const event = JSON.parse(logs.join("\n"));
    expect(event.role).toBe("user");
    expect(event.kind).toBe("message");
    expect(event.text).toBe("hello from desktop");
    expect(event.sessionId).toBeTruthy();

    const lines = fs.readFileSync(path.join(dir, ".ai-session", "conversation.jsonl"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).id).toBe(event.id);
  });

  it("supports explicit role and kind for desktop command events", async () => {
    const dir = setupSession();
    await conversationAppendCommand("/status", { path: dir, role: "user", kind: "command", json: true });

    const event = JSON.parse(logs.join("\n"));
    expect(event.role).toBe("user");
    expect(event.kind).toBe("command");
    expect(event.text).toBe("/status");
  });
});
