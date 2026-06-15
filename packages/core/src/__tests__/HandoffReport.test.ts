import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig } from "../index";
import { HandoffReport } from "../handoff/HandoffReport";
import { ExecutionCheckpoints } from "../plan/ExecutionCheckpoints";

function repo(task = "Add a /health endpoint"): string {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), "rb-report-"));
  new SessionManager(r, defaultConfig).init(task);
  return r;
}

describe("HandoffReport", () => {
  it("renders a markdown report from session + checkpoints", () => {
    const r = repo();
    fs.writeFileSync(path.join(r, ".ai-session", "handoff.md"), "# Handoff\n\nImplemented the route.\n");
    new ExecutionCheckpoints(r, defaultConfig).append({ step: 1, command: "pnpm test", result: "ok" });

    const md = new HandoffReport(r, defaultConfig).generate();
    expect(md).toContain("# relay-baton handoff report");
    expect(md).toContain("Add a /health endpoint");
    expect(md).toContain("## Execution");
    expect(md).toContain("1 ok");
    expect(md).toContain("## Handoff (excerpt)");
    expect(md).toContain("Implemented the route.");
  });

  it("handles a session with no handoff or checkpoints", () => {
    const md = new HandoffReport(repo("nothing yet"), defaultConfig).generate();
    expect(md).toContain("No checkpoints recorded.");
    expect(md).not.toContain("## Handoff (excerpt)");
  });

  it("truncates an oversized handoff excerpt", () => {
    const r = repo();
    fs.writeFileSync(path.join(r, ".ai-session", "handoff.md"), "x".repeat(5000));
    const md = new HandoffReport(r, defaultConfig).generate({ maxExcerptChars: 100 });
    expect(md).toContain("[handoff truncated in report]");
  });
});
