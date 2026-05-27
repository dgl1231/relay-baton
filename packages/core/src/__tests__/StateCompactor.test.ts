import { describe, it, expect } from "vitest";
import { StateCompactor } from "../token-diet/StateCompactor";

describe("StateCompactor", () => {
  it("preserves Current State section structure", () => {
    const state = `# Current State

## Goal
do thing

## Done
- step1

## In Progress

## Remaining
- step2

## Decisions

## Risks

## Next Step
- run tests
`;
    const out = new StateCompactor().compact(state, 5000);
    expect(out).toContain("# Compact State");
    for (const h of ["Goal", "Done", "In Progress", "Remaining", "Decisions", "Risks", "Next Step"]) {
      expect(out).toContain(`## ${h}`);
    }
    expect(out).toContain("do thing");
    expect(out).toContain("run tests");
  });
});
