import * as fs from "fs";
import type { RelayBatonConfig } from "@relay-baton/shared";
import { SessionFiles } from "../session/SessionFiles";
import { GitService } from "../git/GitService";
import { ExecutionCheckpoints } from "./ExecutionCheckpoints";

export interface GuardrailLimits {
  maxSteps: number | null;
  maxChangedFiles: number | null;
  maxBudgetRatio: number | null;
}

export interface GuardrailActual {
  steps: number;
  changedFiles: number;
  budgetRatio: number | null;
}

export interface GuardrailViolation {
  condition: "maxSteps" | "maxChangedFiles" | "maxBudgetRatio";
  limit: number;
  actual: number;
  message: string;
}

export interface GuardrailReport {
  blocked: boolean;
  requireConfirmation: boolean;
  limits: GuardrailLimits;
  actual: GuardrailActual;
  violations: GuardrailViolation[];
}

const DEFAULTS = {
  maxSteps: 25,
  maxChangedFiles: 40,
  maxBudgetRatio: 0.9,
  requireConfirmation: true,
};

/**
 * Deterministic, read-only stop-condition policy for the guarded execution
 * workflow. It compares recorded checkpoints + live git/budget state against
 * project-configurable caps and reports whether execution should stop. It never
 * halts an agent itself — relay-baton reports and the human/agent decides.
 */
export class GuardrailPolicy {
  private files: SessionFiles;
  constructor(private readonly repoRoot: string, private readonly config?: RelayBatonConfig) {
    this.files = new SessionFiles(repoRoot);
  }

  evaluate(): GuardrailReport {
    const g = this.config?.guardrails ?? {};
    const maxSteps = g.maxSteps ?? DEFAULTS.maxSteps;
    const maxChangedFiles = g.maxChangedFiles ?? DEFAULTS.maxChangedFiles;
    const maxBudgetRatio = g.maxBudgetRatio ?? DEFAULTS.maxBudgetRatio;
    const requireConfirmation = g.requireConfirmation ?? DEFAULTS.requireConfirmation;

    const steps = new ExecutionCheckpoints(this.repoRoot, this.config).list().length;
    const summary = new GitService(this.repoRoot).summary(0);
    const changedFiles = summary.changed;
    const budgetRatio = this.budgetRatio();

    const violations: GuardrailViolation[] = [];
    if (maxSteps != null && steps >= maxSteps) {
      violations.push({ condition: "maxSteps", limit: maxSteps, actual: steps, message: `recorded ${steps} checkpoint(s) ≥ cap ${maxSteps}` });
    }
    if (maxChangedFiles != null && changedFiles >= maxChangedFiles) {
      violations.push({ condition: "maxChangedFiles", limit: maxChangedFiles, actual: changedFiles, message: `${changedFiles} changed file(s) ≥ cap ${maxChangedFiles}` });
    }
    if (maxBudgetRatio != null && budgetRatio != null && budgetRatio >= maxBudgetRatio) {
      violations.push({ condition: "maxBudgetRatio", limit: maxBudgetRatio, actual: budgetRatio, message: `budget ratio ${budgetRatio.toFixed(2)} ≥ cap ${maxBudgetRatio}` });
    }

    return {
      blocked: violations.length > 0,
      requireConfirmation,
      limits: { maxSteps, maxChangedFiles, maxBudgetRatio },
      actual: { steps, changedFiles, budgetRatio },
      violations,
    };
  }

  private budgetRatio(): number | null {
    if (!this.config) return null;
    const read = (p: string) => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } };
    let activeProfile = this.config.tokenDiet.profile;
    try {
      const meta = JSON.parse(read(this.files.p("sessionJson")));
      if (meta?.tokenDietProfile) activeProfile = meta.tokenDietProfile;
    } catch { /* use config default */ }
    const profile = this.config.tokenDiet.profiles[activeProfile];
    if (!profile || !profile.maxHandoffChars) return null;
    return read(this.files.p("handoff")).length / profile.maxHandoffChars;
  }
}
