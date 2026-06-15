import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { DependencyInventory } from "../git/DependencyInventory";

function tmp(): string { return fs.mkdtempSync(path.join(os.tmpdir(), "rb-inv-")); }
const write = (root: string, rel: string, content: string) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};

describe("DependencyInventory", () => {
  it("inventories root scripts, workspace packages, CI, and release files", () => {
    const root = tmp();
    write(root, "package.json", JSON.stringify({ name: "x", scripts: { build: "tsc", test: "vitest" } }));
    write(root, "pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n");
    write(root, "packages/core/package.json", JSON.stringify({ name: "@x/core", scripts: { build: "tsc" } }));
    write(root, ".github/workflows/release.yml", "name: release");
    write(root, ".github/workflows/ci.yaml", "name: ci");
    write(root, "RELEASE.md", "# release");
    write(root, "install/install.sh", "#!/bin/sh");

    const inv = new DependencyInventory(root).generate();
    expect(inv.rootScripts).toEqual(expect.arrayContaining(["build", "test"]));
    expect(inv.packages).toHaveLength(1);
    expect(inv.packages[0]).toMatchObject({ name: "@x/core" });
    expect(inv.packages[0].scripts).toContain("build");
    expect(inv.ciWorkflows.sort()).toEqual(["ci.yaml", "release.yml"]);
    expect(inv.releaseFiles).toContain("RELEASE.md");
    expect(inv.releaseFiles).toContain("install/install.sh");
    expect(inv.dependencyManifests).toContain("package.json");
  });

  it("degrades cleanly on an empty folder", () => {
    const inv = new DependencyInventory(tmp()).generate();
    expect(inv.rootScripts).toEqual([]);
    expect(inv.packages).toEqual([]);
    expect(inv.ciWorkflows).toEqual([]);
    expect(inv.dependencyManifests).toEqual([]);
  });
});
