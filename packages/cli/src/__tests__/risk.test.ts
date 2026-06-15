import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { riskCommand } from "../commands/risk";

describe("risk command", () => {
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

  it("emits a JSON risk report flagging a dependency change", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-cli-risk-"));
    spawnSync("git", ["init"], { cwd: repo });
    fs.writeFileSync(path.join(repo, "package.json"), "{}\n");

    await riskCommand({ path: repo, json: true });
    const report = JSON.parse(logs.join("\n"));
    expect(report.available).toBe(true);
    expect(report.risky).toBe(true);
    expect(report.byCategory.dependency).toBeGreaterThan(0);
  });
});
