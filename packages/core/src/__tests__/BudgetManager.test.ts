import { describe, it, expect } from "vitest";
import { BudgetManager } from "../token-diet/BudgetManager";
import { TRUNCATE_MARKER } from "@relay-baton/shared";
import { defaultConfig } from "../config/defaultConfig";

describe("BudgetManager", () => {
  it("truncates with marker when section budget exceeded", () => {
    const p = defaultConfig.tokenDiet.profiles.caveman;
    const bm = new BudgetManager(p);
    const big = "x".repeat(p.maxDiffChars + 1000);
    const out = bm.fit("maxDiffChars", big);
    expect(out.length).toBeLessThanOrEqual(p.maxDiffChars);
    expect(out).toContain(TRUNCATE_MARKER);
    expect(bm.isTruncated()).toBe(true);
  });
  it("does not modify content within budget", () => {
    const p = defaultConfig.tokenDiet.profiles.balanced;
    const bm = new BudgetManager(p);
    const out = bm.fit("maxLogTailChars", "small");
    expect(out).toBe("small");
    expect(bm.isTruncated()).toBe(false);
  });
});
