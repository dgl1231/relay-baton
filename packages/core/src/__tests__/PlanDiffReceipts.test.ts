import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager } from "../session/SessionManager";
import { defaultConfig } from "../config/defaultConfig";
import { diffPlans, backupPlan, latestPlanBackup, planBackupName } from "../plan/PlanDiff";
import { PlanReceipts } from "../plan/PlanReceipts";

function setup(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-pdr-"));
  const sm = new SessionManager(dir, defaultConfig);
  sm.init("pdr test");
  return dir;
}

function writePlan(dir: string, body: string) {
  fs.writeFileSync(path.join(dir, ".ai-session", "plan.md"), body, "utf8");
}

describe("diffPlans", () => {
  it("classifies added/removed/changed/unchanged per section", () => {
    const oldMd = "# p\n## Goal\nold goal\n## Steps\n1. a\n";
    const newMd = "# p\n## Goal\nnew goal\n## Steps\n1. a\n## Risks\nr\n";
    const d = diffPlans(oldMd, newMd);
    const by = Object.fromEntries(d.sections.map(s => [s.section, s.change]));
    expect(by["Goal"]).toBe("changed");
    expect(by["Steps"]).toBe("unchanged");
    expect(by["Risks"]).toBe("added");
    expect(d.changed).toBe(true);
  });
  it("reports changed=false for identical plans", () => {
    const md = "## Goal\ng\n";
    expect(diffPlans(md, md).changed).toBe(false);
  });
});

describe("backupPlan / latestPlanBackup", () => {
  it("backs up plan.md to a timestamped file and finds the latest", () => {
    const dir = setup();
    writePlan(dir, "## Goal\nv1\n");
    const b1 = backupPlan(dir, new Date("2026-05-29T10:00:00.000Z"));
    expect(b1).toBeTruthy();
    expect(path.basename(b1!)).toBe(planBackupName(new Date("2026-05-29T10:00:00.000Z")));
    writePlan(dir, "## Goal\nv2\n");
    backupPlan(dir, new Date("2026-05-29T11:00:00.000Z"));
    const latest = latestPlanBackup(dir);
    expect(fs.readFileSync(latest!, "utf8")).toContain("v2");
  });
  it("returns null when there is no plan", () => {
    const dir = setup();
    expect(backupPlan(dir)).toBeNull();
    expect(latestPlanBackup(dir)).toBeNull();
  });
});

describe("PlanReceipts", () => {
  it("appends done/skipped receipts under a heading and lists them", () => {
    const dir = setup();
    writePlan(dir, "# p\n## Steps\n1. one\n2. two\n");
    const r = new PlanReceipts(dir);
    r.append(1, "done", "implemented");
    r.append(2, "skipped", "not needed");
    const list = r.list();
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ step: 1, status: "done", note: "implemented" });
    expect(list[1]).toMatchObject({ step: 2, status: "skipped", note: "not needed" });
    const body = fs.readFileSync(path.join(dir, ".ai-session", "plan.md"), "utf8");
    expect(body).toContain("## Execution receipts");
    // receipts are append-only; the original Steps section is intact
    expect(body).toContain("1. one");
  });
  it("is a no-op when no plan exists", () => {
    const dir = setup();
    const r = new PlanReceipts(dir);
    r.append(1, "done");
    expect(r.list()).toEqual([]);
  });
});
