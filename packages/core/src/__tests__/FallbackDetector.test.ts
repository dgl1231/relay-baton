import { describe, it, expect } from "vitest";
import { FallbackDetector, resolveFallbackPatterns } from "../agents/FallbackDetector";
import { defaultConfig } from "../config/defaultConfig";

describe("resolveFallbackPatterns (project overlay)", () => {
  it("appends project patterns after globals, deduped case-insensitively", () => {
    const out = resolveFallbackPatterns(
      ["quota exceeded", "rate limit exceeded"],
      ["Custom Org Limit", "QUOTA EXCEEDED", "  "],
    );
    expect(out).toEqual(["quota exceeded", "rate limit exceeded", "Custom Org Limit"]);
  });
  it("returns the globals unchanged when no project patterns are given", () => {
    expect(resolveFallbackPatterns(["a", "b"])).toEqual(["a", "b"]);
  });
  it("a detector built from the overlay catches the project-only phrase", () => {
    const patterns = resolveFallbackPatterns(defaultConfig.fallbackPatterns, ["org seat budget hit"]);
    const d = new FallbackDetector(patterns);
    expect(d.feed("notice: org seat budget hit")?.pattern).toBe("org seat budget hit");
  });
});

describe("FallbackDetector", () => {
  it("detects specific phrases case-insensitively", () => {
    const d = new FallbackDetector(defaultConfig.fallbackPatterns);
    expect(d.feed("nothing here")).toBeNull();
    const hit = d.feed("ERROR: Usage Limit Reached for today");
    expect(hit?.pattern).toBe("usage limit reached");
  });

  it("does not double-fire same pattern", () => {
    const d = new FallbackDetector(["quota exceeded"]);
    expect(d.feed("quota exceeded")).not.toBeNull();
    expect(d.feed("quota exceeded again")).toBeNull();
  });

  it("ignores grep-style search-result lines that mention quota", () => {
    const d = new FallbackDetector(defaultConfig.fallbackPatterns);
    expect(d.feed("README.md:10:- Codex 출력에서 usage/rate/token/context/quota 패턴을 감지한다.")).toBeNull();
    expect(d.feed("packages/core/foo.ts:99: // quota check")).toBeNull();
    expect(d.feed("src/file.ts:12:   if (quota > 0) { ... }")).toBeNull();
  });

  it("ignores documentation lines describing fallback patterns", () => {
    const d = new FallbackDetector(defaultConfig.fallbackPatterns);
    expect(d.feed("Codex 출력에서 usage/rate/token/context/quota 패턴을 감지한다.")).toBeNull();
    expect(d.feed("This is the fallback pattern used.")).toBeNull();
    expect(d.feed("- quota 패턴은 다음과 같다.")).toBeNull();
  });

  it("detects real fallback messages", () => {
    const d1 = new FallbackDetector(defaultConfig.fallbackPatterns);
    expect(d1.feed("Error: quota exceeded; please try again later")).not.toBeNull();

    const d2 = new FallbackDetector(defaultConfig.fallbackPatterns);
    expect(d2.feed("openai: insufficient quota on this account")).not.toBeNull();

    const d3 = new FallbackDetector(defaultConfig.fallbackPatterns);
    expect(d3.feed("HTTP 429: too many requests")).not.toBeNull();

    const d4 = new FallbackDetector(defaultConfig.fallbackPatterns);
    expect(d4.feed("This model's maximum context length is 200000 tokens")).not.toBeNull();
  });
});
