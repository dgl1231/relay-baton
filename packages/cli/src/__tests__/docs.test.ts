import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// packages/cli/src/__tests__ -> repo root is four levels up.
const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

describe("v0.6 docs", () => {
  it("ships docs/ROADMAP.md covering v0.6 through v1.0", () => {
    const roadmap = read("docs/ROADMAP.md");
    for (const v of ["v0.6", "v0.7", "v0.8", "v0.9", "v1.0"]) {
      expect(roadmap).toContain(v);
    }
    expect(roadmap).toMatch(/Trust\s*&?\s*Verify/i);
  });

  it("ships release-notes/v0.6.0.md with the Trust & Verify theme", () => {
    const notes = read("release-notes/v0.6.0.md");
    expect(notes).toMatch(/Trust\s*&?\s*Verify/i);
    expect(notes).toMatch(/doctor --deep/);
    expect(notes).toMatch(/\bverify\b/);
  });

  it("ships a Korean release note for v0.6.0", () => {
    const ko = read("release-notes/ko/v0.6.0.md");
    expect(ko).toMatch(/verify/);
    expect(ko).toMatch(/doctor --deep/);
  });

  it("documents the plan/execute/compress-context workflow in the root README", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/relay-baton plan/);
    expect(readme).toMatch(/relay-baton execute/);
    expect(readme).toMatch(/compress-context/);
    expect(readme).toMatch(/relay-baton verify/);
  });
});
