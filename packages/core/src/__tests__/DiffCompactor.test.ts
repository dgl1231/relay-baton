import { describe, it, expect } from "vitest";
import { DiffCompactor } from "../token-diet/DiffCompactor";

const sampleDiff = `diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index 1..2 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@
-old
+new
diff --git a/src/foo.ts b/src/foo.ts
index 3..4 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@
-foo
+bar
`;

describe("DiffCompactor", () => {
  it("marks lock files as skipped", () => {
    const dc = new DiffCompactor();
    const chunks = dc.splitByFile(sampleDiff);
    const lock = chunks.find(c => c.file === "pnpm-lock.yaml");
    const src = chunks.find(c => c.file === "src/foo.ts");
    expect(lock?.skipped).toBe(true);
    expect(src?.skipped).toBe(false);
  });
  it("omits lock-file diffs from compact output", () => {
    const dc = new DiffCompactor();
    const out = dc.compact(sampleDiff, 10000);
    expect(out).toContain("pnpm-lock.yaml — diff omitted");
    expect(out).toContain("src/foo.ts");
  });
});
