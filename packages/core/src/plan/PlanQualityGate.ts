import * as fs from "fs";
import * as path from "path";
import type { DietProfile } from "@relay-baton/shared";
import { SessionFiles } from "../session/SessionFiles";
import { PLAN_SECTIONS, planSectionBody } from "./PlanSchema";

export interface PlanGateResult {
  ok: boolean;
  failures: string[];
  warnings: string[];
}

/** True if a section body has at least one real (non-placeholder) line. */
function hasContent(body: string): boolean {
  return body
    .split(/\r?\n/)
    .some(l => {
      // Strip leading list markers ("1.", "-", "*") before judging content,
      // so a bullet whose only payload is a "(placeholder)" still counts as empty.
      const t = l.trim().replace(/^(\d+\.|[-*])\s*/, "").trim();
      if (t.length === 0) return false;
      // Skip template placeholders like "(first concrete step)".
      if (/^\(.*\)$/.test(t)) return false;
      return true;
    });
}

export class PlanQualityGate {
  constructor(private repoRoot: string, private profile: DietProfile) {}

  check(): PlanGateResult {
    const files = new SessionFiles(this.repoRoot);
    const failures: string[] = [];
    const warnings: string[] = [];

    const planPath = files.p("plan");
    if (!fs.existsSync(planPath)) {
      return { ok: false, failures: [`plan.md: missing ${planPath}`], warnings };
    }
    const plan = fs.readFileSync(planPath, "utf8");
    if (plan.trim().length === 0) {
      return { ok: false, failures: [`plan.md: empty ${planPath}`], warnings };
    }

    // Required sections present.
    for (const section of PLAN_SECTIONS) {
      if (!new RegExp(`(^|\\n)## ${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(\\n|$)`).test(plan)) {
        failures.push(`plan.md missing section ## ${section}`);
      }
    }

    // Steps must have real content.
    if (!hasContent(planSectionBody(plan, "Steps"))) {
      failures.push("plan.md: Steps section is empty (need at least one concrete step)");
    }
    // Next step must have real content.
    if (!hasContent(planSectionBody(plan, "Next step"))) {
      failures.push("plan.md: Next step section is empty");
    }

    // Budget.
    const maxPlanChars = this.profile.maxPlanChars ?? this.profile.maxHandoffChars;
    if (plan.length > maxPlanChars) {
      failures.push(`plan.md ${plan.length} > maxPlanChars ${maxPlanChars}`);
    }

    // No inlining of large reference material.
    const inlineCheck = (file: string, label: string) => {
      try {
        const text = fs.readFileSync(file, "utf8");
        if (text.length > 200 && plan.includes(text.slice(0, 200))) {
          failures.push(`plan.md inlines ${label}; reference it instead.`);
        }
      } catch { /* missing is fine */ }
    };
    inlineCheck(files.p("commandsLog"), "commands.log");
    inlineCheck(path.join(this.repoRoot, "AGENTS.md"), "AGENTS.md");
    inlineCheck(path.join(this.repoRoot, "CLAUDE.md"), "CLAUDE.md");

    return { ok: failures.length === 0, failures, warnings };
  }
}
