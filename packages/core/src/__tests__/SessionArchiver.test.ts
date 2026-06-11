import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { defaultConfig } from "../config/defaultConfig";
import { SessionArchiver } from "../session/SessionArchiver";
import { SessionManager } from "../session/SessionManager";

describe("SessionArchiver", () => {
  it("archives .ai-session files with a manifest and checksums", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-archive-repo-"));
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "rb-archive-out-"));
    const sm = new SessionManager(repo, defaultConfig);
    sm.init("archive me");
    fs.writeFileSync(sm.files.p("handoff"), "# Handoff\n", "utf8");

    const result = new SessionArchiver(repo).archive({
      archiveRoot: out,
      now: new Date("2026-06-11T00:00:00.000Z"),
    });

    expect(result.available).toBe(true);
    expect(result.dryRun).toBe(false);
    expect(result.archiveDir).toContain(out);
    expect(fs.existsSync(path.join(result.archiveDir!, "task.md"))).toBe(true);
    expect(fs.existsSync(path.join(result.archiveDir!, "handoff.md"))).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(path.join(result.archiveDir!, "manifest.json"), "utf8"));
    expect(manifest.files.some((f: any) => f.target.endsWith("task.md") && f.sha256.length === 64)).toBe(true);
  });

  it("dry-run reports planned archive without writing", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-archive-dry-"));
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "rb-archive-dry-out-"));
    new SessionManager(repo, defaultConfig).init("dry");

    const result = new SessionArchiver(repo).archive({ archiveRoot: out, dryRun: true });

    expect(result.available).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.manifest?.files.length).toBeGreaterThan(0);
    expect(fs.existsSync(result.archiveDir!)).toBe(false);
  });

  it("reports unavailable when no session exists", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-no-session-"));
    const result = new SessionArchiver(repo).archive();

    expect(result.available).toBe(false);
    expect(result.reason).toContain(".ai-session");
  });
});
