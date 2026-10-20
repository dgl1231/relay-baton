import { describe, it, expect } from "vitest";
import { resolveChain, resolveHops } from "../commands/run";

const config = { primaryAgent: "codex" as const, fallbackAgent: "claude" as const };

describe("resolveChain — deterministic who's-next policy (v2.3)", () => {
  it("defaults to the config primary -> fallback pair", () => {
    expect(resolveChain({}, undefined, config)).toEqual(["codex", "claude"]);
  });

  it("supports reverse relay via flags (claude -> codex)", () => {
    expect(resolveChain({ primary: "claude", fallback: "codex" }, undefined, config)).toEqual(["claude", "codex"]);
  });

  it("project overrides beat config but lose to flags", () => {
    const project = { primaryAgent: "gemini" as const, fallbackAgent: "aider" as const };
    expect(resolveChain({}, project, config)).toEqual(["gemini", "aider"]);
    expect(resolveChain({ primary: "cursor" }, project, config)).toEqual(["cursor", "aider"]);
  });

  it("uses the work item's assigned agent as default primary (loses to flags)", () => {
    expect(resolveChain({}, undefined, config, "gemini")).toEqual(["gemini", "claude"]);
    // explicit --primary still wins over the assignment
    expect(resolveChain({ primary: "codex" }, undefined, config, "gemini")).toEqual(["codex", "claude"]);
    // assignment beats project override
    expect(resolveChain({}, { primaryAgent: "aider" }, config, "cursor")).toEqual(["cursor", "claude"]);
  });

  it("supports an explicit N-way chain that overrides primary/fallback", () => {
    expect(resolveChain({ chain: "claude,codex,gemini" }, undefined, config)).toEqual(["claude", "codex", "gemini"]);
    expect(resolveChain({ chain: "codex, claude , cursor" }, undefined, config)).toEqual(["codex", "claude", "cursor"]);
  });

  it("collapses immediate duplicates and a single-agent chain", () => {
    expect(resolveChain({ chain: "codex,codex,claude" }, undefined, config)).toEqual(["codex", "claude"]);
    expect(resolveChain({ primary: "codex", fallback: "codex" }, undefined, config)).toEqual(["codex"]);
  });
});

describe("resolveHops — model-aware relay hops (v1.7)", () => {
  it("parses agent:model entries and keeps same-agent model fallback as two hops", () => {
    expect(resolveHops({ chain: "claude:claude-opus-5-5,claude:claude-sonnet-5,codex" }, undefined, config)).toEqual([
      { agent: "claude", model: "claude-opus-5-5" },
      { agent: "claude", model: "claude-sonnet-5" },
      { agent: "codex", model: undefined },
    ]);
  });

  it("--model fills the first hop only when its entry names no model", () => {
    expect(resolveHops({ model: "gpt-6.1-sol" }, undefined, config)).toEqual([
      { agent: "codex", model: "gpt-6.1-sol" },
      { agent: "claude", model: undefined },
    ]);
    expect(resolveHops({ chain: "codex:gpt-6-luna", model: "gpt-6.1-sol" }, undefined, config)[0].model).toBe("gpt-6-luna");
  });
});
