import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig } from "@relay-baton/core";
import { sessionArchiveCommand } from "../commands/session";

describe("session archive command", () => {
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

  it("emits JSON for a dry-run archive", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-session-archive-"));
    new SessionManager(repo, defaultConfig).init("archive via cli");

    await sessionArchiveCommand({ path: repo, json: true, dryRun: true });

    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.available).toBe(true);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.manifest.files.length).toBeGreaterThan(0);
  });
});
