import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { defaultConfig } from "../index";
import { ProjectProfile } from "../git/ProjectProfile";

function tmp(): string { return fs.mkdtempSync(path.join(os.tmpdir(), "rb-profile-")); }
const write = (root: string, rel: string, content: string) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};

describe("ProjectProfile", () => {
  it("derives framework tags and recommended commands from a pnpm project", () => {
    const root = tmp();
    write(root, "package.json", JSON.stringify({
      name: "x",
      scripts: { build: "tsc", test: "vitest" },
      devDependencies: { vitest: "^1", commander: "^12" },
    }));
    write(root, "pnpm-lock.yaml", "");
    write(root, "tsconfig.json", "{}");

    const profile = new ProjectProfile(root, defaultConfig).generate();
    expect(profile.frameworks).toContain("vitest");
    expect(profile.frameworks).toContain("commander");
    expect(profile.tags).toContain("typescript");
    expect(profile.recommended.build).toBe("pnpm run build");
    expect(profile.recommended.test).toBe("pnpm run test");
    expect(profile.excludePaths).toContain("node_modules");
  });

  it("prefers explicit config commands over derived ones", () => {
    const root = tmp();
    write(root, "package.json", JSON.stringify({ name: "x", scripts: { build: "tsc" } }));
    write(root, "pnpm-lock.yaml", "");
    const config = { ...defaultConfig, commands: { build: "make all", test: "make check" } };
    const profile = new ProjectProfile(root, config).generate();
    expect(profile.recommended.build).toBe("make all");
    expect(profile.recommended.test).toBe("make check");
  });

  it("falls back to cargo commands for a rust project", () => {
    const root = tmp();
    write(root, "Cargo.toml", "[package]\nname=\"x\"\n");
    const profile = new ProjectProfile(root, defaultConfig).generate();
    expect(profile.recommended.build).toBe("cargo build");
    expect(profile.recommended.test).toBe("cargo test");
  });
});
