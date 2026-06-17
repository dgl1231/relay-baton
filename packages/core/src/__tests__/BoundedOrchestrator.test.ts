import { describe, it, expect } from "vitest";
import { BoundedOrchestrator } from "../runtime/BoundedOrchestrator";
import type { GuardrailReport } from "../plan/GuardrailPolicy";

function okGuardrail(requireConfirmation = true): GuardrailReport {
  return {
    blocked: false,
    requireConfirmation,
    limits: { maxSteps: 25, maxChangedFiles: 40, maxBudgetRatio: 0.9 },
    actual: { steps: 0, changedFiles: 0, budgetRatio: 0 },
    violations: [],
  };
}

function blockedGuardrail(): GuardrailReport {
  return {
    blocked: true,
    requireConfirmation: true,
    limits: { maxSteps: 2, maxChangedFiles: 40, maxBudgetRatio: 0.9 },
    actual: { steps: 2, changedFiles: 0, budgetRatio: 0 },
    violations: [{ condition: "maxSteps", limit: 2, actual: 2, message: "recorded 2 ≥ cap 2" }],
  };
}

describe("BoundedOrchestrator (v2.5)", () => {
  it("proceeds up to the step cap then stops with max-steps", () => {
    const o = new BoundedOrchestrator({ maxSteps: 2 });
    expect(o.next().proceed).toBe(true);   // step 1
    expect(o.next().proceed).toBe(true);   // step 2
    const d = o.next();
    expect(d.proceed).toBe(false);
    expect(d.reason).toBe("max-steps");
  });

  it("stops on budget ceiling", () => {
    const o = new BoundedOrchestrator({ maxSteps: 5, budgetCeiling: 0.9 });
    expect(o.next().proceed).toBe(true);
    const d = o.next({ budgetRatio: 0.95 });
    expect(d.proceed).toBe(false);
    expect(d.reason).toBe("budget");
  });

  it("stops on divergence (no progress two steps in a row)", () => {
    const o = new BoundedOrchestrator({ maxSteps: 5 });
    expect(o.next().proceed).toBe(true);
    expect(o.next({ progressKey: "x" }).proceed).toBe(true);
    const d = o.next({ progressKey: "x" });
    expect(d.proceed).toBe(false);
    expect(d.reason).toBe("divergence");
  });

  it("stops when the guardrail policy is blocked", () => {
    const o = new BoundedOrchestrator({ maxSteps: 5, evaluateGuardrail: () => blockedGuardrail() });
    const d = o.next();
    expect(d.proceed).toBe(false);
    expect(d.reason).toBe("guardrail");
    expect(d.guardrail?.violations[0].condition).toBe("maxSteps");
  });

  it("surfaces requireConfirmation from the guardrail policy", () => {
    const needsConfirm = new BoundedOrchestrator({ maxSteps: 5, evaluateGuardrail: () => okGuardrail(true) });
    expect(needsConfirm.next().requireConfirmation).toBe(true);
    const noConfirm = new BoundedOrchestrator({ maxSteps: 5, evaluateGuardrail: () => okGuardrail(false) });
    expect(noConfirm.next().requireConfirmation).toBe(false);
  });

  it("explicit stop halts the loop", () => {
    const o = new BoundedOrchestrator({ maxSteps: 5 });
    o.stop();
    const d = o.next();
    expect(d.proceed).toBe(false);
    expect(d.reason).toBe("explicit-stop");
  });
});
