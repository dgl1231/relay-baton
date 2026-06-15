import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { RiskClassifier } from "../plan/RiskClassifier";

function gitRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-risk-"));
  spawnSync("git", ["init"], { cwd: repo });
  return repo;
}

describe("RiskClassifier", () => {
  it("reports unavailable for a non-git folder", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-risk-nogit-"));
    const report = new RiskClassifier(dir).evaluate();
    expect(report.available).toBe(false);
    expect(report.risky).toBe(false);
  });

  it("flags dependency, binary, and env/config changes", () => {
    const repo = gitRepo();
    fs.writeFileSync(path.join(repo, "package.json"), "{}\n");
    fs.writeFileSync(path.join(repo, "app.exe"), "binary");
    fs.writeFileSync(path.join(repo, "tsconfig.json"), "{}\n");
    fs.writeFileSync(path.join(repo, "readme.txt"), "plain\n");

    const report = new RiskClassifier(repo).evaluate();
    expect(report.available).toBe(true);
    expect(report.risky).toBe(true);
    const cats = report.findings.map(f => f.category);
    expect(cats).toContain("dependency");
    expect(cats).toContain("binary");
    expect(cats).toContain("env-config");
    // a plain text file is not flagged
    expect(report.findings.find(f => f.path === "readme.txt")).toBeUndefined();
  });

  it("flags file deletion as high severity", () => {
    const repo = gitRepo();
    fs.writeFileSync(path.join(repo, "keep.txt"), "x\n");
    spawnSync("git", ["add", "-A"], { cwd: repo });
    spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", "init"], { cwd: repo });
    fs.rmSync(path.join(repo, "keep.txt"));

    const report = new RiskClassifier(repo).evaluate();
    expect(report.risky).toBe(true);
    expect(report.bySeverity.high).toBeGreaterThan(0);
    expect(report.findings.some(f => f.category === "deletion")).toBe(true);
  });

  it("reports no risk for a clean tree", () => {
    const repo = gitRepo();
    const report = new RiskClassifier(repo).evaluate();
    expect(report.available).toBe(true);
    expect(report.risky).toBe(false);
    expect(report.findings).toHaveLength(0);
  });
});
