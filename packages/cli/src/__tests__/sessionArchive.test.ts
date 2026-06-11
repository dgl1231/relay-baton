import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig } from "@relay-baton/core";
import { sessionArchiveCommand, sessionListCommand, sessionInspectCommand, sessionResumeCommand } from "../commands/session";

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

  it("lists and inspects an archive via JSON", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-session-list-"));
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "rb-session-out-"));
    new SessionManager(repo, defaultConfig).init("list via cli");
    await sessionArchiveCommand({ path: repo, out });

    logs.length = 0;
    await sessionListCommand({ json: true, out });
    const list = JSON.parse(logs.join("\n"));
    expect(list.available).toBe(true);
    expect(list.archives.length).toBeGreaterThan(0);

    const id = list.archives[0].id;
    logs.length = 0;
    await sessionInspectCommand(id, { json: true, out });
    const inspect = JSON.parse(logs.join("\n"));
    expect(inspect.available).toBe(true);
    expect(inspect.intact).toBe(true);
  });

  it("emits resume diagnostics as JSON", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-session-resume-"));
    new SessionManager(repo, defaultConfig).init("resume via cli");

    await sessionResumeCommand({ path: repo, json: true });
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.available).toBe(true);
    expect(["ok", "stale", "incomplete"]).toContain(parsed.status);
    expect(parsed.suggestions.length).toBeGreaterThan(0);
  });
});
