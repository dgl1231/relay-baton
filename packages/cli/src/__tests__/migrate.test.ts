import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig } from "@relay-baton/core";
import { migrateCommand } from "../commands/migrate";

describe("migrate command", () => {
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

  it("emits a JSON schema report for --check", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-cli-migrate-"));
    new SessionManager(repo, defaultConfig).init("migrate via cli");

    await migrateCommand({ path: repo, check: true, json: true });
    const report = JSON.parse(logs.join("\n"));
    expect(report.exists).toBe(true);
    expect(report.ok).toBe(true);
    expect(report.checks.find((c: any) => c.file === "session.json").status).toBe("ok");
  });
});
