import { describe, it, expect } from "vitest";
import { PromptBuilder } from "../handoff/PromptBuilder";
import { PLAN_SECTIONS } from "../plan/PlanSchema";

describe("PromptBuilder.planner", () => {
  const p = PromptBuilder.planner("Add a /health endpoint");

  it("instructs the planner NOT to write code", () => {
    expect(p).toMatch(/DO NOT write or edit any source code/i);
    expect(p).toMatch(/Only produce plan\.md/i);
  });

  it("lists every required plan section", () => {
    for (const s of PLAN_SECTIONS) expect(p).toContain(`## ${s}`);
  });

  it("embeds the task and forbids inlining reference files", () => {
    expect(p).toContain("Add a /health endpoint");
    expect(p).toMatch(/never inline full diffs, logs, AGENTS\.md, or CLAUDE\.md/i);
  });
});

describe("PromptBuilder.executor", () => {
  const e = PromptBuilder.executor();

  it("points the executor at plan.md and its Next step", () => {
    expect(e).toMatch(/\.ai-session\/plan\.md/);
    expect(e).toMatch(/start from its Next step|starting from its Next step|Begin from the Next step/i);
  });

  it("requires escalation to errors.md on divergence and forbids rewriting the plan", () => {
    expect(e).toMatch(/errors\.md/);
    expect(e).toMatch(/Do not rewrite plan\.md/i);
  });

  it("keeps the no-auto-commit rule", () => {
    expect(e).toMatch(/Do not auto-commit/i);
  });
});
