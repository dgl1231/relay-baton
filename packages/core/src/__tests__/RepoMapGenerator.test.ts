import { describe, it, expect } from "vitest";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { RepoMapGenerator } from "../git/RepoMapGenerator";

describe("RepoMapGenerator", () => {
  it("ignores node_modules, dist, .git", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-"));
    fs.mkdirSync(path.join(dir, "node_modules", "x"), { recursive: true });
    fs.writeFileSync(path.join(dir, "node_modules", "x", "index.js"), "x");
    fs.mkdirSync(path.join(dir, "dist"), { recursive: true });
    fs.writeFileSync(path.join(dir, "dist", "bundle.js"), "x");
    fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src.ts"), "x");
    fs.writeFileSync(path.join(dir, "package.json"), "{}");
    const map = new RepoMapGenerator(dir).generate(10000);
    expect(map).not.toMatch(/node_modules/);
    expect(map).not.toMatch(/(^|\n)\s*dist\//);
    expect(map).not.toMatch(/\.git\//);
    expect(map).toContain("src.ts");
    expect(map).toContain("package.json");
  });
});
