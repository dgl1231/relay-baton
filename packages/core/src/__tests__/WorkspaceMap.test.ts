import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { WorkspaceMap } from "../git/WorkspaceMap";

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rb-ws-"));
}
const write = (root: string, rel: string, content: string) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};

describe("WorkspaceMap", () => {
  it("detects a pnpm monorepo with packages, scripts, and entry points", () => {
    const root = tmp();
    write(root, "package.json", JSON.stringify({
      name: "monorepo",
      main: "dist/index.js",
      scripts: { build: "tsc", test: "vitest", lint: "eslint .", release: "do-release" },
    }));
    write(root, "pnpm-lock.yaml", "");
    write(root, "pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n");
    write(root, "tsconfig.json", "{}");
    write(root, "README.md", "# hi");
    write(root, "CLAUDE.md", "rules");
    write(root, "packages/core/package.json", JSON.stringify({ name: "@x/core" }));
    write(root, "packages/cli/package.json", JSON.stringify({ name: "@x/cli" }));

    const map = new WorkspaceMap(root).generate();
    expect(map.packageManagers).toContain("pnpm");
    expect(map.languages).toContain("typescript");
    expect(map.monorepo).toBe(true);
    expect(map.packages.map(p => p.name).sort()).toEqual(["@x/cli", "@x/core"]);
    expect(map.scripts.build).toBe("tsc");
    expect(map.scripts.test).toBe("vitest");
    expect(map.scripts.others).toContain("release");
    expect(map.entryPoints).toContain("dist/index.js");
    expect(map.docs).toContain("README.md");
    expect(map.agentsFiles).toContain("CLAUDE.md");
  });

  it("detects a cargo project as non-monorepo rust", () => {
    const root = tmp();
    write(root, "Cargo.toml", "[package]\nname = \"x\"\n");
    write(root, "src/main.rs", "fn main(){}");
    const map = new WorkspaceMap(root).generate();
    expect(map.packageManagers).toContain("cargo");
    expect(map.languages).toContain("rust");
    expect(map.monorepo).toBe(false);
    expect(map.entryPoints).toContain("src/main.rs");
  });

  it("degrades cleanly on an empty folder", () => {
    const map = new WorkspaceMap(tmp()).generate();
    expect(map.packageManagers).toEqual([]);
    expect(map.packages).toEqual([]);
    expect(map.monorepo).toBe(false);
    expect(map.scripts.build).toBeNull();
  });
});
