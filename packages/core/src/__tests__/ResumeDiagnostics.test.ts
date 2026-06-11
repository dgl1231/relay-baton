import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig } from "../index";
import { ResumeDiagnostics } from "../session/ResumeDiagnostics";

function tmpRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rb-resume-"));
}

describe("ResumeDiagnostics", () => {
  it("reports missing when there is no .ai-session", () => {
    const d = new ResumeDiagnostics(tmpRepo()).diagnose();
    expect(d.available).toBe(false);
    expect(d.status).toBe("missing");
    expect(d.suggestions[0].command).toBe("init");
  });

  it("reports ok for a fresh session", () => {
    const repo = tmpRepo();
    new SessionManager(repo, defaultConfig).init("resume ok");
    const d = new ResumeDiagnostics(repo).diagnose();
    expect(d.available).toBe(true);
    expect(d.status).toBe("ok");
    expect(d.suggestions.some(s => s.command === "status")).toBe(true);
  });

  it("reports incomplete when session.json is removed", () => {
    const repo = tmpRepo();
    new SessionManager(repo, defaultConfig).init("resume incomplete");
    fs.rmSync(path.join(repo, ".ai-session", "session.json"));
    const d = new ResumeDiagnostics(repo).diagnose();
    expect(d.status).toBe("incomplete");
    expect(d.missingFiles).toContain("session.json");
    expect(d.suggestions.some(s => s.command === "init")).toBe(true);
  });

  it("reports stale when the session aged past the threshold", () => {
    const repo = tmpRepo();
    new SessionManager(repo, defaultConfig).init("resume stale");
    const future = new Date(Date.now() + 48 * 3600_000);
    const d = new ResumeDiagnostics(repo).diagnose({ now: future, staleHours: 24 });
    expect(d.status).toBe("stale");
    expect(d.suggestions.some(s => s.command === "handoff")).toBe(true);
  });
});
