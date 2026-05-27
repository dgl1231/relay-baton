import { describe, it, expect } from "vitest";
import { deterministicCompress } from "../token-diet/DeterministicCompress";

describe("deterministicCompress", () => {
  it("removes duplicate blank lines and trailing whitespace", () => {
    const src = "# Title\n\n\n\nbody  \nbody  \n\n\nmore\n";
    const out = deterministicCompress(src);
    expect(out).not.toMatch(/\n{3,}/);
    expect(out).not.toMatch(/ +\n/);
    expect(out.match(/^body$/gm)?.length).toBe(1);
  });
  it("preserves code blocks verbatim", () => {
    const src = "before\n\n```ts\n\n\nconst x = 1;\n\n\n```\nafter\n";
    const out = deterministicCompress(src);
    expect(out).toContain("```ts\n\n\nconst x = 1;\n\n\n```");
  });
});
