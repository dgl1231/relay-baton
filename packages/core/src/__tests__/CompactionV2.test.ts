import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { outlineContent, outlineFile } from "../token-diet/SymbolOutline";
import { DiffCompactor } from "../token-diet/DiffCompactor";
import { RepoMapGenerator } from "../git/RepoMapGenerator";

describe("SymbolOutline (v2.4)", () => {
  it("extracts exported TS symbols", () => {
    const src = [
      "import x from 'y';",
      "export function alpha() {}",
      "export class Beta {}",
      "export interface Gamma {}",
      "export const delta = 1;",
      "function helper() {}",
    ].join("\n");
    expect(outlineContent("a.ts", src)).toEqual(["alpha", "Beta", "Gamma", "delta", "helper"]);
  });

  it("extracts python defs/classes and markdown headings", () => {
    expect(outlineContent("a.py", "def foo():\n  pass\nclass Bar:\n  pass")).toEqual(["foo", "Bar"]);
    expect(outlineContent("README.md", "# Title\n## Sub\ntext\n### Deep")).toEqual(["# Title", "## Sub", "### Deep"]);
  });

  it("returns nothing for unknown extensions and caps the count", () => {
    expect(outlineContent("a.bin", "whatever")).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => `export function f${i}() {}`).join("\n");
    expect(outlineContent("a.ts", many, 5)).toHaveLength(5);
  });

  it("outlineFile reads from disk and skips empty outlines", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-sym-"));
    fs.writeFileSync(path.join(dir, "x.ts"), "export const onlyOne = 1;\n");
    fs.writeFileSync(path.join(dir, "plain.txt"), "no symbols here");
    expect(outlineFile(dir, "x.ts")?.symbols).toEqual(["onlyOne"]);
    expect(outlineFile(dir, "plain.txt")).toBeNull();
    expect(outlineFile(dir, "missing.ts")).toBeNull();
  });
});

describe("DiffCompactor.compactRanked (v2.4)", () => {
  const diff = [
    "diff --git a/docs/readme.md b/docs/readme.md",
    "@@\n-a\n+b",
    "diff --git a/src/deep/nested/util.ts b/src/deep/nested/util.ts",
    "@@\n-a\n+b",
    "diff --git a/src/target.ts b/src/target.ts",
    "@@\n-a\n+b",
  ].join("\n");

  it("ranks the task-mentioned file first", () => {
    const out = new DiffCompactor().compactRanked(diff, 10000, { task: "fix src/target.ts please" });
    const order = ["src/target.ts", "src/deep/nested/util.ts", "docs/readme.md"].map(f => out.indexOf(f));
    expect(order[0]).toBeGreaterThanOrEqual(0);
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
  });

  it("keeps the most relevant diff when the budget is tight", () => {
    const out = new DiffCompactor().compactRanked(diff, 120, { task: "work on src/target.ts" });
    expect(out).toContain("src/target.ts");
  });

  it("still omits lock files (skipped sink to the bottom)", () => {
    const withLock = "diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml\n@@\n-x\n+y\n" + diff;
    const out = new DiffCompactor().compactRanked(withLock, 10000, { task: "src/target.ts" });
    expect(out).toContain("pnpm-lock.yaml — diff omitted");
    expect(out.indexOf("src/target.ts")).toBeLessThan(out.indexOf("pnpm-lock.yaml"));
  });
});

describe("RepoMapGenerator symbol section (v2.4)", () => {
  it("emits a Symbols section outlining changed files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-map-"));
    fs.writeFileSync(path.join(dir, "package.json"), "{}");
    fs.mkdirSync(path.join(dir, "src"));
    fs.writeFileSync(path.join(dir, "src", "feature.ts"), "export function doThing() {}\nexport class Widget {}\n");
    const map = new RepoMapGenerator(dir).generate(10000, ["src/feature.ts"]);
    expect(map).toContain("## Symbols (changed + key files)");
    expect(map).toContain("- src/feature.ts");
    expect(map).toContain("  - doThing");
    expect(map).toContain("  - Widget");
  });
});
