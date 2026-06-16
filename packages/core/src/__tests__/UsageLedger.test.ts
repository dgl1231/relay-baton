import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SESSION_DIR, SESSION_FILES } from "@relay-baton/shared";
import { UsageLedger, charsToTokenProxy } from "../token-diet/UsageLedger";

function tmpRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-usage-"));
  fs.mkdirSync(path.join(dir, SESSION_DIR), { recursive: true });
  return dir;
}

describe("UsageLedger (v2.4)", () => {
  it("token proxy is ceil(chars/4)", () => {
    expect(charsToTokenProxy(0)).toBe(0);
    expect(charsToTokenProxy(4)).toBe(1);
    expect(charsToTokenProxy(5)).toBe(2);
  });

  it("appends events and summarizes by type and agent", () => {
    const repo = tmpRepo();
    const led = new UsageLedger(repo);
    led.record("handoff", "claude", 4000, "codex→claude");
    led.record("handoff", "codex", 2000, "claude→codex");
    led.record("run", "codex", 400);

    const s = led.summarize();
    expect(s.available).toBe(true);
    expect(s.events).toBe(3);
    expect(s.handoffCount).toBe(2);
    expect(s.totalChars).toBe(6400);
    expect(s.totalTokensProxy).toBe(1000 + 500 + 100);
    expect(s.byType.handoff).toBe(1500);
    expect(s.byType.run).toBe(100);
    expect(s.byAgent.claude).toBe(1000);
    expect(s.byAgent.codex).toBe(600);
  });

  it("computes a budget ratio against maxHandoffChars", () => {
    const repo = tmpRepo();
    const led = new UsageLedger(repo);
    led.record("handoff", "claude", 40000); // 10000 tokens
    // maxHandoffChars 40000 -> 10000 token budget -> ratio 1.0
    expect(led.summarize(40000).budgetRatio).toBe(1);
    expect(led.summarize().budgetRatio).toBeNull();
  });

  it("persists to .ai-session/usage.jsonl and tolerates malformed lines", () => {
    const repo = tmpRepo();
    new UsageLedger(repo).record("handoff", "claude", 100);
    const file = path.join(repo, SESSION_DIR, SESSION_FILES.usage);
    fs.appendFileSync(file, "{ not json\n\n");
    const s = new UsageLedger(repo).summarize();
    expect(s.events).toBe(1);
  });

  it("is empty/unavailable before any record", () => {
    expect(new UsageLedger(tmpRepo()).summarize().available).toBe(false);
  });
});
