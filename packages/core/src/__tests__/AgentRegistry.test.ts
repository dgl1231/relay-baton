import { describe, it, expect } from "vitest";
import {
  AGENT_REGISTRY,
  ALL_AGENT_IDS,
  getAgentDescriptor,
  isAgentId,
  agentFallbackPatterns,
} from "../agents/AgentRegistry";
import { CursorAdapter } from "../agents/CursorAdapter";
import { defaultConfig } from "../config/defaultConfig";
import { validateConfig } from "../config/ConfigSchema";

const FORBIDDEN = ["--full-auto", "--ask-for-approval", "bypassPermissions", "--yes", "--dangerously-bypass-approvals-and-sandbox"];

describe("AgentRegistry", () => {
  it("covers the full agent matrix including the v2.3 additions", () => {
    expect(ALL_AGENT_IDS.sort()).toEqual(["aider", "claude", "codex", "cursor", "gemini", "opencode"]);
  });

  it("marks codex/claude first-class and the rest supported", () => {
    expect(AGENT_REGISTRY.codex.tier).toBe("first-class");
    expect(AGENT_REGISTRY.claude.tier).toBe("first-class");
    for (const id of ["opencode", "gemini", "aider", "cursor"] as const) {
      expect(AGENT_REGISTRY[id].tier).toBe("supported");
    }
  });

  it("every descriptor has install URL, login instructions, and fallback patterns", () => {
    for (const id of ALL_AGENT_IDS) {
      const d = getAgentDescriptor(id);
      expect(d.installUrl).toMatch(/^https?:\/\//);
      expect(d.login.instructions.length).toBeGreaterThan(0);
      expect(d.fallbackPatterns.length).toBeGreaterThan(0);
      if (d.login.kind === "subcommand") expect(d.login.subcommand?.length).toBeGreaterThan(0);
    }
  });

  it("no default args carry approval-bypass / auto-commit flags", () => {
    for (const id of ALL_AGENT_IDS) {
      for (const bad of FORBIDDEN) expect(AGENT_REGISTRY[id].defaultArgs).not.toContain(bad);
    }
  });

  it("registry defaults match defaultConfig.agents", () => {
    for (const id of ALL_AGENT_IDS) {
      expect(defaultConfig.agents[id]).toEqual({
        command: AGENT_REGISTRY[id].command,
        args: AGENT_REGISTRY[id].defaultArgs,
      });
    }
  });

  it("isAgentId guards unknown ids", () => {
    expect(isAgentId("cursor")).toBe(true);
    expect(isAgentId("nope")).toBe(false);
  });

  it("agentFallbackPatterns returns the agent's signals", () => {
    expect(agentFallbackPatterns("gemini")).toContain("resource_exhausted");
    expect(agentFallbackPatterns("codex")).toContain("usage limit reached");
  });

  it("default config (with cursor) still validates", () => {
    expect(validateConfig(defaultConfig).ok).toBe(true);
  });
});

describe("CursorAdapter", () => {
  it("uses the cursor-agent binary with non-interactive -p and prefers prompt", () => {
    const a = new CursorAdapter();
    expect(a.id).toBe("cursor");
    expect(a.displayName).toBe("Cursor CLI");
    const c = a.buildCommand({ task: "T", prompt: "P", repoRoot: "/r", sessionDir: "/r/.ai-session" });
    expect(c.command).toBe("cursor-agent");
    expect(c.args).toEqual(["-p", "P"]);
    expect(c.cwd).toBe("/r");
  });

  it("falls back to task when prompt is omitted", () => {
    const c = new CursorAdapter().buildCommand({ task: "T", repoRoot: "/r", sessionDir: "/r/.ai-session" });
    expect(c.args).toEqual(["-p", "T"]);
  });

  it("returns false from detectAvailable when binary is missing", async () => {
    const a = new CursorAdapter({ command: "definitely-not-cursor-xyz", args: ["-p"] });
    expect(await a.detectAvailable()).toBe(false);
  });
});
