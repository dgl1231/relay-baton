import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { CodexAdapter } from "../agents/CodexAdapter";
import { ClaudeCodeAdapter, summarizeToolInput } from "../agents/ClaudeCodeAdapter";
import { runAgent } from "../agents/AgentRunner";
import { defaultConfig } from "../config/defaultConfig";
import type { AgentEvent } from "@relay-baton/shared";

describe("ClaudeCodeAdapter structured stream", () => {
  const a = new ClaudeCodeAdapter();

  it("buildCommand adds stream-json flags before the prompt when structuredStream", () => {
    const c = a.buildCommand({ task: "x", prompt: "PROMPT", repoRoot: "/r", sessionDir: "/r/.ai-session", structuredStream: true });
    expect(c.args).toEqual([
      "--permission-mode", "acceptEdits", "-p",
      "--output-format", "stream-json", "--verbose",
      "PROMPT",
    ]);
  });

  it("buildCommand is unchanged without structuredStream", () => {
    const c = a.buildCommand({ task: "x", prompt: "PROMPT", repoRoot: "/r", sessionDir: "/r/.ai-session" });
    expect(c.args).toEqual(["--permission-mode", "acceptEdits", "-p", "PROMPT"]);
  });

  it("parses system init into a system event", () => {
    const evs = a.parseEvent(JSON.stringify({ type: "system", subtype: "init", model: "claude-x", session_id: "s1" }));
    expect(evs).toEqual([{ type: "system", text: "model claude-x · session s1" }]);
  });

  it("parses assistant content blocks into text / reasoning / tool_use events", () => {
    const evs = a.parseEvent(JSON.stringify({
      type: "assistant",
      message: { content: [
        { type: "thinking", thinking: "let me check" },
        { type: "text", text: "done, two files changed" },
        { type: "tool_use", name: "Bash", input: { command: "git status" } },
      ]},
    }));
    expect(evs).toEqual([
      { type: "reasoning", text: "let me check" },
      { type: "assistant_text", text: "done, two files changed" },
      { type: "tool_use", tool: "Bash", detail: "git status" },
    ]);
  });

  it("suppresses tool results and partial deltas", () => {
    expect(a.parseEvent(JSON.stringify({ type: "user", message: {} }))).toEqual([]);
    expect(a.parseEvent(JSON.stringify({ type: "stream_event" }))).toEqual([]);
  });

  it("parses the final result into usage (success) or error", () => {
    const ok = a.parseEvent(JSON.stringify({
      type: "result", subtype: "success", is_error: false, result: "final",
      total_cost_usd: 0.0123, duration_ms: 4200, usage: { input_tokens: 100, output_tokens: 50 },
    }));
    expect(ok).toEqual([{ type: "usage", usage: { inputTokens: 100, outputTokens: 50, costUsd: 0.0123, durationMs: 4200 } }]);
    const err = a.parseEvent(JSON.stringify({ type: "result", is_error: true, result: "credit exhausted" }));
    expect(err).toEqual([{ type: "error", text: "credit exhausted" }]);
  });

  it("returns null for raw / unknown lines (pass-through contract)", () => {
    expect(a.parseEvent("plain text line")).toBeNull();
    expect(a.parseEvent("{not json")).toBeNull();
    expect(a.parseEvent(JSON.stringify({ type: "future_thing" }))).toBeNull();
  });

  it("suppresses rate_limit_event telemetry (not raw pass-through)", () => {
    const evs = a.parseEvent(JSON.stringify({
      type: "rate_limit_event",
      rate_limit_info: { status: "allowed", resetsAt: 1784523600, rateLimitType: "five_hour" },
    }));
    expect(evs).toEqual([]);
  });

  it("summarizeToolInput picks a stable field and truncates", () => {
    expect(summarizeToolInput({ command: "ls -la" })).toBe("ls -la");
    expect(summarizeToolInput({ file_path: "/a/b.ts" })).toBe("/a/b.ts");
    expect(summarizeToolInput(null)).toBeUndefined();
    expect(summarizeToolInput({ command: "x".repeat(200) })!.length).toBe(160);
  });
});

describe("CodexAdapter structured stream", () => {
  const a = new CodexAdapter();

  it("buildCommand adds --json before the task when structuredStream", () => {
    const c = a.buildCommand({ task: "fix bug", repoRoot: "/r", sessionDir: "/r/.ai-session", structuredStream: true });
    expect(c.args).toEqual(["exec", "--sandbox", "workspace-write", "--json", "fix bug"]);
  });

  it("renders only completed items (started/updated suppressed)", () => {
    expect(a.parseEvent(JSON.stringify({ type: "item.started", item: { item_type: "agent_message", text: "hi" } }))).toEqual([]);
    expect(a.parseEvent(JSON.stringify({ type: "item.updated", item: { item_type: "agent_message", text: "hi" } }))).toEqual([]);
    const evs = a.parseEvent(JSON.stringify({ type: "item.completed", item: { item_type: "agent_message", text: "hi" } }));
    expect(evs).toEqual([{ type: "assistant_text", text: "hi" }]);
  });

  it("maps command execution and file changes to tool_use", () => {
    const exec = a.parseEvent(JSON.stringify({
      type: "item.completed",
      item: { item_type: "command_execution", command: "pnpm test", exit_code: 0 },
    }));
    expect(exec).toEqual([{ type: "tool_use", tool: "exec", detail: "pnpm test (exit 0)" }]);
    const edit = a.parseEvent(JSON.stringify({
      type: "item.completed",
      item: { item_type: "file_change", changes: [{ path: "a.ts" }, { path: "b.ts" }] },
    }));
    expect(edit).toEqual([{ type: "tool_use", tool: "edit", detail: "a.ts, b.ts" }]);
  });

  it("parses turn completion into usage and failures into error", () => {
    const usage = a.parseEvent(JSON.stringify({ type: "turn.completed", usage: { input_tokens: 9, output_tokens: 4 } }));
    expect(usage).toEqual([{ type: "usage", usage: { inputTokens: 9, outputTokens: 4 } }]);
    const fail = a.parseEvent(JSON.stringify({ type: "turn.failed", error: { message: "quota exceeded" } }));
    expect(fail).toEqual([{ type: "error", text: "quota exceeded" }]);
  });

  it("unwraps the upstream API error codex nests as a JSON string (captured from codex-cli 0.134.0)", () => {
    const nested = JSON.stringify({ type: "error", status: 400, error: { type: "invalid_request_error", message: "Please upgrade." } });
    const evs = a.parseEvent(JSON.stringify({ type: "turn.failed", error: { message: nested } }));
    expect(evs).toEqual([{ type: "error", text: "Please upgrade." }]);
  });

  it("returns null for raw / unknown lines", () => {
    expect(a.parseEvent("[2026-07-14] codex banner")).toBeNull();
    expect(a.parseEvent(JSON.stringify({ type: "future_thing" }))).toBeNull();
  });
});

describe("runAgent event routing", () => {
  it("routes parsed lines to onEvent and unparsed lines to onStdout", async () => {
    const logFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rb-stream-")), "commands.log");
    const script = [
      `console.log(JSON.stringify({ type: "item.completed", item: { item_type: "agent_message", text: "structured" } }));`,
      `console.log("raw line");`,
    ].join("");
    const adapter = new CodexAdapter();
    const events: AgentEvent[] = [];
    const raw: string[] = [];
    const r = await runAgent({
      command: { command: process.execPath, args: ["-e", script], cwd: process.cwd() },
      logFile,
      authPolicy: defaultConfig.authPolicy,
      parseEvent: (l) => adapter.parseEvent(l),
      onEvent: (ev) => events.push(ev),
      onStdout: (l) => raw.push(l),
    });
    expect(r.exitCode).toBe(0);
    expect(events).toEqual([{ type: "assistant_text", text: "structured" }]);
    expect(raw).toEqual(["raw line"]);
    // the raw JSONL still lands in the log file untouched
    const log = fs.readFileSync(logFile, "utf8");
    expect(log).toContain("agent_message");
    expect(log).toContain("raw line");
  });
});
