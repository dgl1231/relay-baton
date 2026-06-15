import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { profileCommand } from "../commands/profile";
import { inventoryCommand } from "../commands/inventory";

describe("project intelligence commands", () => {
  let logs: string[];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.map(a => String(a)).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("profile emits JSON with recommended commands", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-cli-profile-"));
    fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ name: "x", scripts: { build: "tsc", test: "vitest" } }));
    fs.writeFileSync(path.join(repo, "pnpm-lock.yaml"), "");

    await profileCommand({ path: repo, json: true });
    const profile = JSON.parse(logs.join("\n"));
    expect(profile.recommended.build).toBe("pnpm run build");
    expect(profile.recommended.test).toBe("pnpm run test");
  });

  it("inventory emits JSON with root scripts", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-cli-inv-"));
    fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ name: "x", scripts: { build: "tsc" } }));

    await inventoryCommand({ path: repo, json: true });
    const inv = JSON.parse(logs.join("\n"));
    expect(inv.rootScripts).toContain("build");
    expect(inv.dependencyManifests).toContain("package.json");
  });
});
