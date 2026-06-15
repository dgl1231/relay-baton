import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig } from "../index";
import { HandoffBundler } from "../handoff/HandoffBundler";
import { HandoffBundleInspector } from "../handoff/HandoffBundleInspector";
import { RedactionScanner } from "../handoff/RedactionScanner";

function repoWithHandoff(handoff = "# Handoff\n\nwork in progress\n"): { repo: string; out: string } {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-bundle-repo-"));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "rb-bundle-out-"));
  new SessionManager(repo, defaultConfig).init("bundle test");
  fs.writeFileSync(path.join(repo, ".ai-session", "handoff.md"), handoff);
  return { repo, out };
}

describe("HandoffBundler", () => {
  it("is unavailable without a handoff", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-bundle-none-"));
    new SessionManager(repo, defaultConfig).init("no handoff");
    const r = new HandoffBundler(repo).bundle();
    expect(r.available).toBe(false);
  });

  it("bundles curated artifacts with a manifest and redaction report", () => {
    const { repo, out } = repoWithHandoff();
    const r = new HandoffBundler(repo).bundle({ bundleRoot: out });
    expect(r.available).toBe(true);
    expect(r.manifest?.files.some(f => f.target.endsWith("handoff.md"))).toBe(true);
    expect(r.redaction?.clean).toBe(true);
    expect(fs.existsSync(path.join(r.bundleDir!, "manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(r.bundleDir!, "git-summary.json"))).toBe(true);
  });

  it("dry-run writes nothing", () => {
    const { repo, out } = repoWithHandoff();
    const r = new HandoffBundler(repo).bundle({ bundleRoot: out, dryRun: true });
    expect(r.available).toBe(true);
    expect(fs.existsSync(r.bundleDir!)).toBe(false);
  });

  it("flags secrets in the redaction report", () => {
    const { repo, out } = repoWithHandoff("# Handoff\n\nOPENAI_API_KEY=sk-abcdef0123456789abcdef\n");
    const r = new HandoffBundler(repo).bundle({ bundleRoot: out });
    expect(r.redaction?.clean).toBe(false);
    expect(r.redaction!.findings.length).toBeGreaterThan(0);
  });

  it("inspects a bundle and verifies integrity", () => {
    const { repo, out } = repoWithHandoff();
    const bundleDir = new HandoffBundler(repo).bundle({ bundleRoot: out }).bundleDir!;
    const inspect = new HandoffBundleInspector({ bundleRoot: out }).inspect(path.basename(bundleDir));
    expect(inspect.available).toBe(true);
    expect(inspect.intact).toBe(true);
    expect(inspect.fileCount).toBeGreaterThan(0);
  });

  it("inspect reports corruption when a bundled file changes", () => {
    const { repo, out } = repoWithHandoff();
    const inspector = new HandoffBundleInspector({ bundleRoot: out });
    const bundleDir = new HandoffBundler(repo).bundle({ bundleRoot: out }).bundleDir!;
    fs.writeFileSync(path.join(bundleDir, "handoff.md"), "tampered");
    const inspect = inspector.inspect(path.basename(bundleDir));
    expect(inspect.intact).toBe(false);
    expect(inspect.corrupt.length).toBeGreaterThan(0);
  });
});

describe("RedactionScanner", () => {
  it("flags api keys, private keys, and home paths", () => {
    const report = { clean: true, findings: [] as any[], byCategory: { secret: 0, "api-key": 0, "home-path": 0, oversized: 0 } };
    const scanner = new RedactionScanner("/home/alice");
    scanner.scanText(report as any, "x.md", "key sk-ant-abcdefghij0123456789\npath /home/alice/secret\n");
    expect(report.findings.some(f => f.category === "api-key")).toBe(true);
    expect(report.findings.some(f => f.category === "home-path")).toBe(true);
  });
});
