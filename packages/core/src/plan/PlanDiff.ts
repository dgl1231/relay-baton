import * as fs from "fs";
import * as path from "path";
import { SessionFiles } from "../session/SessionFiles";
import { PLAN_SECTIONS, planSectionBody } from "./PlanSchema";

export type SectionChange = "added" | "removed" | "changed" | "unchanged";

export interface PlanSectionDelta {
  section: string;
  change: SectionChange;
}

export interface PlanDiffResult {
  /** Per canonical section, how it changed between old and new. */
  sections: PlanSectionDelta[];
  /** True if any section differs. */
  changed: boolean;
}

/**
 * Deterministic section-level diff between two plan documents. No model call.
 * Compares the body text under each canonical `## <section>` heading.
 */
export function diffPlans(oldMd: string, newMd: string): PlanDiffResult {
  const sections: PlanSectionDelta[] = [];
  for (const section of PLAN_SECTIONS) {
    const a = planSectionBody(oldMd, section);
    const b = planSectionBody(newMd, section);
    let change: SectionChange;
    if (a === b) change = "unchanged";
    else if (!a && b) change = "added";
    else if (a && !b) change = "removed";
    else change = "changed";
    sections.push({ section, change });
  }
  return {
    sections,
    changed: sections.some(s => s.change !== "unchanged"),
  };
}

/** A timestamped backup name for plan.md, e.g. plan.2026-05-29T10-32-11-000Z.md. */
export function planBackupName(date = new Date()): string {
  const ts = date.toISOString().replace(/[:.]/g, "-");
  return `plan.${ts}.md`;
}

/**
 * Back up the current plan.md (if present) to plan.<ts>.md in the session dir.
 * Returns the backup's absolute path, or null when there is no plan to back up.
 */
export function backupPlan(repoRoot: string, date = new Date()): string | null {
  const files = new SessionFiles(repoRoot);
  const planPath = files.p("plan");
  let body = "";
  try { body = fs.readFileSync(planPath, "utf8"); } catch { return null; }
  if (!body.trim()) return null;
  const dest = path.join(files.dir, planBackupName(date));
  try { fs.writeFileSync(dest, body, "utf8"); } catch { return null; }
  return dest;
}

/** Most recent plan.<ts>.md backup path, or null when none exist. */
export function latestPlanBackup(repoRoot: string): string | null {
  const files = new SessionFiles(repoRoot);
  let names: string[] = [];
  try { names = fs.readdirSync(files.dir); } catch { return null; }
  const backups = names
    .filter(n => /^plan\.\d{4}-\d{2}-\d{2}T[\d-]+Z\.md$/.test(n))
    .sort();
  if (backups.length === 0) return null;
  return path.join(files.dir, backups[backups.length - 1]);
}
