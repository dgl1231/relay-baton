import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { workspaceCommand } from "../commands/workspace";

describe("workspace command", () => {
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

  it("emits a JSON workspace map", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-cli-ws-"));
    fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ name: "x", scripts: { build: "tsc" } }));
    fs.writeFileSync(path.join(repo, "package-lock.json"), "{}");

    await workspaceCommand({ path: repo, json: true });
    const map = JSON.parse(logs.join("\n"));
    expect(map.packageManagers).toContain("npm");
    expect(map.scripts.build).toBe("tsc");
  });
});
