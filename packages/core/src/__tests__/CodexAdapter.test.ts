import { describe, it, expect } from "vitest";
import { CodexAdapter } from "../agents/CodexAdapter";
import { ClaudeCodeAdapter } from "../agents/ClaudeCodeAdapter";

describe("CodexAdapter", () => {
  it("builds default command with sandbox workspace-write and task last", () => {
    const a = new CodexAdapter();
    const c = a.buildCommand({ task: "fix bug", repoRoot: "/r", sessionDir: "/r/.ai-session" });
    expect(c.command).toBe("codex");
    expect(c.args).toEqual(["exec", "--sandbox", "workspace-write", "fix bug"]);
    expect(c.cwd).toBe("/r");
  });
  it("config-provided args override default", () => {
    const a = new CodexAdapter({ command: "codex", args: ["exec", "--custom"] });
    const c = a.buildCommand({ task: "t", repoRoot: ".", sessionDir: "." });
    expect(c.args).toEqual(["exec", "--custom", "t"]);
  });
});

describe("ClaudeCodeAdapter", () => {
  it("uses --permission-mode acceptEdits and -p with prompt last", () => {
    const a = new ClaudeCodeAdapter();
    const c = a.buildCommand({ task: "x", prompt: "PROMPT", repoRoot: "/r", sessionDir: "/r/.ai-session" });
    expect(c.command).toBe("claude");
    expect(c.args).toEqual(["--permission-mode", "acceptEdits", "-p", "PROMPT"]);
  });
});
