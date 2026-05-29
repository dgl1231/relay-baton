import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { SessionManager } from "../session/SessionManager";
import { PlanReview, extractPaths, parseSteps } from "../plan/PlanReview";
import { defaultConfig } from "../config/defaultConfig";

function git(dir: string, args: string[]) {
  spawnSync("git", args, { cwd: dir, encoding: "utf8" });
}

function setupRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-review-"));
  git(dir, ["init"]);
  git(dir, ["config", "user.email", "t@t.dev"]);
  git(dir, ["config", "user.name", "t"]);
  fs.writeFileSync(path.join(dir, "seed.txt"), "seed\n");
  git(dir, ["add", "."]);
  git(dir, ["commit", "-m", "seed"]);
  const sm = new SessionManager(dir, defaultConfig);
  sm.init("review test");
  return dir;
}

function writePlan(dir: string, steps: string[]) {
  const md = [
    "# relay-baton plan",
    "## Steps",
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(dir, ".ai-session", "plan.md"), md, "utf8");
}

describe("extractPaths", () => {
  it("pulls backtick spans and slash/extension tokens", () => {
    const paths = extractPaths("edit `packages/core/foo.ts` and src/bar.js too");
    expect(paths).toContain("packages/core/foo.ts");
    expect(paths).toContain("src/bar.js");
  });
  it("ignores plain words without a slash or extension", () => {
    expect(extractPaths("refactor the parser logic")).toEqual([]);
  });
});

describe("parseSteps", () => {
  it("numbers steps and skips placeholders", () => {
    const md = "## Steps\n1. first\n2. second\n3. (placeholder)\n";
    const steps = parseSteps(md);
    expect(steps.map(s => s.text)).toEqual(["first", "second"]);
    expect(steps[0].index).toBe(1);
  });
});

describe("PlanReview.run", () => {
  it("correlates changed files to steps and flags unplanned changes", () => {
    const dir = setupRepo();
    writePlan(dir, [
      "create `src/alpha.ts`",
      "update `src/beta.ts`",
      "general cleanup with no path",
    ]);
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "alpha.ts"), "x\n");
    fs.writeFileSync(path.join(dir, "unrelated.ts"), "y\n");

    const r = new PlanReview(dir, defaultConfig).run();
    expect(r.planPresent).toBe(true);
    expect(r.steps).toHaveLength(3);
    expect(r.touchedSteps).toBe(1);
    expect(r.untouchedSteps).toBe(1);
    expect(r.uncorrelatedSteps).toBe(1);
    expect(r.unplannedFiles).toContain("unrelated.ts");
    expect(r.changedFiles).toContain("src/alpha.ts");
  });

  it("reports planPresent=false when no plan exists", () => {
    const dir = setupRepo();
    const r = new PlanReview(dir, defaultConfig).run();
    expect(r.planPresent).toBe(false);
    expect(r.steps).toEqual([]);
  });
});
