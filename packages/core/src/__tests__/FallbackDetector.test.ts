import { describe, it, expect } from "vitest";
import { FallbackDetector } from "../agents/FallbackDetector";
import { defaultConfig } from "../config/defaultConfig";

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
