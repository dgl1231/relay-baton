import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig } from "@relay-baton/core";
import { guardCommand } from "../commands/guard";

describe("guard command", () => {
  let logs: string[];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.map(a => String(a)).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it("emits a JSON guardrail report", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-cli-guard-"));
    new SessionManager(repo, defaultConfig).init("guard via cli");

    await guardCommand({ path: repo, json: true });
    const report = JSON.parse(logs.join("\n"));
    expect(report).toHaveProperty("blocked");
    expect(report).toHaveProperty("limits");
    expect(report).toHaveProperty("actual");
    expect(typeof report.blocked).toBe("boolean");
  });
});
