import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig } from "@relay-baton/core";
import { handoffBundleCommand, handoffInspectCommand } from "../commands/handoffBundle";
import { reportCommand } from "../commands/report";

describe("handoff bundle command", () => {
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

  it("bundles and inspects via JSON", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-cli-bundle-"));
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "rb-cli-bundle-out-"));
    new SessionManager(repo, defaultConfig).init("bundle via cli");
    fs.writeFileSync(path.join(repo, ".ai-session", "handoff.md"), "# Handoff\n\ndone\n");

    await handoffBundleCommand({ path: repo, out, json: true });
    const bundled = JSON.parse(logs.join("\n"));
    expect(bundled.available).toBe(true);
    expect(bundled.manifest.files.length).toBeGreaterThan(0);

    const id = path.basename(bundled.bundleDir);
    logs.length = 0;
    await handoffInspectCommand(id, { out, json: true });
    const inspect = JSON.parse(logs.join("\n"));
    expect(inspect.available).toBe(true);
    expect(inspect.intact).toBe(true);
  });

  it("report emits markdown wrapped in JSON", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-cli-report-"));
    new SessionManager(repo, defaultConfig).init("report via cli");

    await reportCommand({ path: repo, json: true });
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.markdown).toContain("# relay-baton handoff report");
    expect(parsed.markdown).toContain("report via cli");
  });
});
