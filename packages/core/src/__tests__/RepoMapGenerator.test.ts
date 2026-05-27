import { describe, it, expect } from "vitest";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { RepoMapGenerator } from "../git/RepoMapGenerator";

describe("RepoMapGenerator", () => {
  it("ignores node_modules, dist, .git, .next, .turbo, coverage, bin, obj, build", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-"));
    for (const d of ["node_modules", "dist", "build", ".git", ".next", ".turbo", "coverage", "bin", "obj"]) {
      fs.mkdirSync(path.join(dir, d), { recursive: true });
      fs.writeFileSync(path.join(dir, d, "x.js"), "x");
    }
    fs.writeFileSync(path.join(dir, "src.ts"), "x");
    fs.writeFileSync(path.join(dir, "package.json"), "{}");
    const map = new RepoMapGenerator(dir).generate(10000);
    for (const d of ["node_modules", "dist/", "build/", ".git/", ".next/", ".turbo/", "coverage/", "bin/", "obj/"]) {
      expect(map).not.toContain(d);
    }
    expect(map).toContain("src.ts");
    expect(map).toContain("package.json");
  });
});
