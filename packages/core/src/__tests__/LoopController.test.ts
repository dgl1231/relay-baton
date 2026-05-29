import { describe, it, expect } from "vitest";
import { LoopController } from "../runtime/LoopController";

describe("LoopController", () => {
  it("clamps maxSteps to >= 1 and caps iterations", () => {
    const c = new LoopController({ maxSteps: 0 });
    expect(c.next().proceed).toBe(true); // step 1
    const d = c.next();
    expect(d.proceed).toBe(false);
    expect(d.reason).toBe("max-steps");
    expect(d.step).toBe(1);
  });

  it("runs up to maxSteps then stops with max-steps", () => {
    const c = new LoopController({ maxSteps: 3 });
    expect(c.next().step).toBe(1);
    expect(c.next().step).toBe(2);
    expect(c.next().step).toBe(3);
    const d = c.next();
    expect(d.proceed).toBe(false);
    expect(d.reason).toBe("max-steps");
  });

  it("stops when budgetRatio meets the ceiling", () => {
    const c = new LoopController({ maxSteps: 10, budgetCeiling: 0.9 });
    expect(c.next().proceed).toBe(true);
    const d = c.next({ budgetRatio: 0.9 });
    expect(d.proceed).toBe(false);
    expect(d.reason).toBe("budget");
  });

  it("defaults budget ceiling to 0.95", () => {
    const c = new LoopController({ maxSteps: 10 });
    expect(c.next().proceed).toBe(true);
    expect(c.next({ budgetRatio: 0.94 }).proceed).toBe(true);
    expect(c.next({ budgetRatio: 0.95 }).reason).toBe("budget");
  });

  it("flags divergence on repeated progressKey across consecutive steps", () => {
    const c = new LoopController({ maxSteps: 10 });
    expect(c.next({ progressKey: "a" }).proceed).toBe(true); // step 1
    expect(c.next({ progressKey: "b" }).proceed).toBe(true); // step 2, progress
    const d = c.next({ progressKey: "b" }); // same as last -> diverge
    expect(d.proceed).toBe(false);
    expect(d.reason).toBe("divergence");
  });

  it("does not flag divergence on the very first observation", () => {
    const c = new LoopController({ maxSteps: 10 });
    expect(c.next({ progressKey: "x" }).proceed).toBe(true);
  });

  it("honors explicit stop", () => {
    const c = new LoopController({ maxSteps: 10 });
    expect(c.next().proceed).toBe(true);
    c.stop();
    const d = c.next();
    expect(d.proceed).toBe(false);
    expect(d.reason).toBe("explicit-stop");
  });

  it("exposes currentStep", () => {
    const c = new LoopController({ maxSteps: 5 });
    expect(c.currentStep).toBe(0);
    c.next();
    expect(c.currentStep).toBe(1);
  });
});
