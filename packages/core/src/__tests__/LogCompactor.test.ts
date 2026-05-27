import { describe, it, expect } from "vitest";
import { LogCompactor } from "../token-diet/LogCompactor";

describe("LogCompactor", () => {
  it("returns tail not entire log", () => {
    const lc = new LogCompactor();
    const raw = "line\n".repeat(2000);
    const r = lc.compact(raw, 200, ["quota"]);
    expect(r.tail.length).toBeLessThanOrEqual(200);
    expect(r.tail.length).toBeLessThan(raw.length);
  });
  it("captures known errors and patterns", () => {
    const lc = new LogCompactor();
    const raw = "ok\nbuild failed\nweird stuff\nUsage limit reached\n--- exit 1 ---\n";
    const r = lc.compact(raw, 5000, ["usage limit"]);
    expect(r.knownErrors.some(e => /build failed/i.test(e))).toBe(true);
    expect(r.knownErrors.some(e => /usage limit/.test(e))).toBe(true);
    expect(r.exitCodes).toContain(1);
  });
});
