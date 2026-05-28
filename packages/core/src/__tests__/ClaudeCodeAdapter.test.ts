import { describe, it, expect } from "vitest";
import { ClaudeCodeAdapter } from "../agents/ClaudeCodeAdapter";
import { createAgentEnv } from "../agents/AgentRunner";
import { defaultConfig } from "../config/defaultConfig";

describe("ClaudeCodeAdapter", () => {
  describe("identity", () => {
    it("reports the canonical id and displayName", () => {
      const a = new ClaudeCodeAdapter();
      expect(a.id).toBe("claude");
      expect(a.displayName).toBe("Claude Code CLI");
    });
  });

  describe("buildCommand()", () => {
    it("uses default args --permission-mode acceptEdits -p with the prompt appended last", () => {
      const a = new ClaudeCodeAdapter();
      const c = a.buildCommand({
        task: "ignored when prompt is provided",
        prompt: "RESUME",
        repoRoot: "/repo",
        sessionDir: "/repo/.ai-session",
      });
      expect(c.command).toBe("claude");
      expect(c.args).toEqual(["--permission-mode", "acceptEdits", "-p", "RESUME"]);
      expect(c.cwd).toBe("/repo");
    });

    it("falls back to input.task when prompt is omitted", () => {
      const a = new ClaudeCodeAdapter();
      const c = a.buildCommand({
        task: "fix bug",
        repoRoot: "/repo",
        sessionDir: "/repo/.ai-session",
      });
      expect(c.args).toEqual(["--permission-mode", "acceptEdits", "-p", "fix bug"]);
    });

    it("config-provided args override the default args, prompt still appended last", () => {
      const a = new ClaudeCodeAdapter({
        command: "claude",
        args: ["-p"],
      });
      const c = a.buildCommand({
        task: "t",
        prompt: "PROMPT",
        repoRoot: "/r",
        sessionDir: "/r/.ai-session",
      });
      expect(c.args).toEqual(["-p", "PROMPT"]);
    });

    it("config can replace the executable name entirely (custom path / shim)", () => {
      const a = new ClaudeCodeAdapter({
        command: "/opt/custom/claude",
        args: ["--permission-mode", "acceptEdits", "-p"],
      });
      const c = a.buildCommand({ task: "t", repoRoot: "/x", sessionDir: "/x/.ai-session" });
      expect(c.command).toBe("/opt/custom/claude");
      expect(c.cwd).toBe("/x");
    });

    it("does NOT use --full-auto, --ask-for-approval, or bypassPermissions in defaults", () => {
      // Guards against accidental regressions of v0.3's CLI safety policy.
      const a = new ClaudeCodeAdapter();
      const c = a.buildCommand({ task: "t", repoRoot: "/r", sessionDir: "/r/.ai-session" });
      const joined = c.args.join(" ");
      expect(joined).not.toContain("--full-auto");
      expect(joined).not.toContain("--ask-for-approval");
      expect(joined).not.toContain("bypassPermissions");
    });

    it("treats an empty prompt string as the value to pass (no implicit fallback)", () => {
      // Calling with prompt: "" is an explicit caller choice. Adapter must not
      // silently substitute task; that would surprise the caller.
      const a = new ClaudeCodeAdapter();
      const c = a.buildCommand({
        task: "task body",
        prompt: "",
        repoRoot: "/r",
        sessionDir: "/r/.ai-session",
      });
      // input.prompt ?? input.task → "" is not nullish, so "" wins.
      expect(c.args[c.args.length - 1]).toBe("");
    });
  });

  describe("detectAvailable()", () => {
    it("returns a boolean without throwing, even if `claude` is not installed", async () => {
      // Point at a deliberately bogus command to ensure the adapter handles
      // spawnSync ENOENT gracefully (returns false rather than throwing).
      const a = new ClaudeCodeAdapter({
        command: "definitely-not-on-path-claude-xyz",
        args: ["--permission-mode", "acceptEdits", "-p"],
      });
      const result = await a.detectAvailable();
      expect(typeof result).toBe("boolean");
      expect(result).toBe(false);
    });
  });

  describe("auth-safety contract (composed with AgentRunner.createAgentEnv)", () => {
    it("by default, env filtering strips API keys before they reach a Claude subprocess", () => {
      // The adapter itself just builds an AgentCommand; env filtering happens
      // in AgentRunner. This test pins the integration: with the default
      // authPolicy and no --allow-api-key-env override, both blocked vars are
      // removed from the env the Claude subprocess would inherit.
      const { env, removed } = createAgentEnv(
        {
          ANTHROPIC_API_KEY: "sk-anth-test",
          OPENAI_API_KEY: "sk-test",
          PATH: "/usr/bin",
        } as NodeJS.ProcessEnv,
        defaultConfig.authPolicy,
        false,
      );
      expect(env.ANTHROPIC_API_KEY).toBeUndefined();
      expect(env.OPENAI_API_KEY).toBeUndefined();
      expect(env.PATH).toBe("/usr/bin");
      expect(removed.sort()).toEqual(["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]);
    });

    it("--allow-api-key-env=true passes the Anthropic key through (explicit opt-in)", () => {
      const { env, removed } = createAgentEnv(
        { ANTHROPIC_API_KEY: "sk-anth-test", PATH: "/usr/bin" } as NodeJS.ProcessEnv,
        defaultConfig.authPolicy,
        true,
      );
      expect(env.ANTHROPIC_API_KEY).toBe("sk-anth-test");
      expect(removed).toEqual([]);
    });
  });
});
