import { describe, it, expect } from "vitest";
import { PromptBuilder } from "../handoff/PromptBuilder";

describe("PromptBuilder.claudeContinuation", () => {
  it("includes handoff and token diet rules and file refs", () => {
    const p = PromptBuilder.claudeContinuation();
    expect(p).toMatch(/relay-baton/);
    expect(p).toMatch(/AGENTS\.md/);
    expect(p).toMatch(/CLAUDE\.md/);
    expect(p).toMatch(/\.ai-session\/handoff\.md/);
    expect(p).toMatch(/\.ai-session\/compact-state\.md/);
    expect(p).toMatch(/Token diet rules:/);
    expect(p).toMatch(/Do not auto-commit/);
  });
});
