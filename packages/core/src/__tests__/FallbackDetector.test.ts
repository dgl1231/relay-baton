import { describe, it, expect } from "vitest";
import { FallbackDetector } from "../agents/FallbackDetector";

describe("FallbackDetector", () => {
  it("detects case-insensitively", () => {
    const d = new FallbackDetector(["Usage Limit", "rate limit"]);
    expect(d.feed("nothing here")).toBeNull();
    const hit = d.feed("ERROR: usage LIMIT reached");
    expect(hit?.pattern).toBe("usage limit");
  });
  it("does not double-fire same pattern", () => {
    const d = new FallbackDetector(["quota"]);
    expect(d.feed("quota exceeded")).not.toBeNull();
    expect(d.feed("quota again")).toBeNull();
  });
});
