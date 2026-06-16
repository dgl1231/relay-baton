import { describe, it, expect } from "vitest";
import { resolveChain } from "../commands/run";

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

  it("supports an explicit N-way chain that overrides primary/fallback", () => {
    expect(resolveChain({ chain: "claude,codex,gemini" }, undefined, config)).toEqual(["claude", "codex", "gemini"]);
    expect(resolveChain({ chain: "codex, claude , cursor" }, undefined, config)).toEqual(["codex", "claude", "cursor"]);
  });

  it("collapses immediate duplicates and a single-agent chain", () => {
    expect(resolveChain({ chain: "codex,codex,claude" }, undefined, config)).toEqual(["codex", "claude"]);
    expect(resolveChain({ primary: "codex", fallback: "codex" }, undefined, config)).toEqual(["codex"]);
  });
});
