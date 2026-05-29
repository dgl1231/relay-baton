import { describe, it, expect } from "vitest";
import { OpenCodeAdapter } from "../agents/OpenCodeAdapter";
import { GeminiAdapter } from "../agents/GeminiAdapter";
import { AiderAdapter } from "../agents/AiderAdapter";

const FORBIDDEN = ["--full-auto", "--ask-for-approval", "bypassPermissions", "--yes"];

describe("OpenCodeAdapter", () => {
  it("has the canonical id/displayName and default `run` args", () => {
    const a = new OpenCodeAdapter();
    expect(a.id).toBe("opencode");
    expect(a.displayName).toBe("OpenCode CLI");
    const c = a.buildCommand({ task: "T", prompt: "P", repoRoot: "/r", sessionDir: "/r/.ai-session" });
    expect(c.command).toBe("opencode");
    expect(c.args).toEqual(["run", "P"]);
    expect(c.cwd).toBe("/r");
  });
  it("falls back to task when prompt is omitted", () => {
    const c = new OpenCodeAdapter().buildCommand({ task: "T", repoRoot: "/r", sessionDir: "/r/.ai-session" });
    expect(c.args).toEqual(["run", "T"]);
  });
  it("returns false from detectAvailable when binary is missing", async () => {
    const a = new OpenCodeAdapter({ command: "definitely-not-opencode-xyz", args: ["run"] });
    expect(await a.detectAvailable()).toBe(false);
  });
});

describe("GeminiAdapter", () => {
  it("has the canonical id/displayName and default `-p` args", () => {
    const a = new GeminiAdapter();
    expect(a.id).toBe("gemini");
    expect(a.displayName).toBe("Gemini CLI");
    const c = a.buildCommand({ task: "T", prompt: "P", repoRoot: "/r", sessionDir: "/r/.ai-session" });
    expect(c.args).toEqual(["-p", "P"]);
  });
  it("returns false from detectAvailable when binary is missing", async () => {
    const a = new GeminiAdapter({ command: "definitely-not-gemini-xyz", args: ["-p"] });
    expect(await a.detectAvailable()).toBe(false);
  });
});

describe("AiderAdapter", () => {
  it("has the canonical id/displayName and is message-oriented (prefers task)", () => {
    const a = new AiderAdapter();
    expect(a.id).toBe("aider");
    expect(a.displayName).toBe("Aider CLI");
    const c = a.buildCommand({ task: "do thing", prompt: "ignored", repoRoot: "/r", sessionDir: "/r/.ai-session" });
    expect(c.args).toEqual(["--message", "do thing"]);
  });
  it("returns false from detectAvailable when binary is missing", async () => {
    const a = new AiderAdapter({ command: "definitely-not-aider-xyz", args: ["--message"] });
    expect(await a.detectAvailable()).toBe(false);
  });
});

describe("scaffold adapters never embed approval-bypass flags in defaults", () => {
  it("no forbidden flags appear", () => {
    for (const a of [new OpenCodeAdapter(), new GeminiAdapter(), new AiderAdapter()]) {
      const joined = a.buildCommand({ task: "t", repoRoot: "/r", sessionDir: "/r/.ai-session" }).args.join(" ");
      for (const bad of FORBIDDEN) expect(joined).not.toContain(bad);
    }
  });
});
