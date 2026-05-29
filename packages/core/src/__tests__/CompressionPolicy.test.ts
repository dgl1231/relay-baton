import { describe, it, expect } from "vitest";
import { resolveCompressionThreshold, DEFAULT_COMPRESSION_THRESHOLD } from "../token-diet/CompressionPolicy";

describe("resolveCompressionThreshold", () => {
  it("falls back to DEFAULT when nothing is configured", () => {
    expect(resolveCompressionThreshold({})).toBe(DEFAULT_COMPRESSION_THRESHOLD);
  });

  it("uses the global threshold when no agent override exists", () => {
    const cfg = { contextCompression: { enabled: true, auto: true, threshold: 0.7, rotateRawArtifacts: true } };
    expect(resolveCompressionThreshold(cfg)).toBe(0.7);
    expect(resolveCompressionThreshold(cfg, "codex")).toBe(0.7);
  });

  it("prefers a per-agent override over the global threshold", () => {
    const cfg = {
      contextCompression: {
        enabled: true, auto: true, threshold: 0.7, rotateRawArtifacts: true,
        perAgent: { claude: 0.9, codex: 0.5 } as Record<string, number>,
      },
    } as any;
    expect(resolveCompressionThreshold(cfg, "claude")).toBe(0.9);
    expect(resolveCompressionThreshold(cfg, "codex")).toBe(0.5);
    expect(resolveCompressionThreshold(cfg, "gemini")).toBe(0.7);
  });

  it("clamps out-of-range values back to the global/default", () => {
    const cfg = {
      contextCompression: {
        enabled: true, auto: true, threshold: 1.5, rotateRawArtifacts: true,
        perAgent: { claude: -1 } as Record<string, number>,
      },
    } as any;
    // global 1.5 invalid -> default; agent -1 invalid -> falls back to that global
    expect(resolveCompressionThreshold(cfg)).toBe(DEFAULT_COMPRESSION_THRESHOLD);
    expect(resolveCompressionThreshold(cfg, "claude")).toBe(DEFAULT_COMPRESSION_THRESHOLD);
  });
});
