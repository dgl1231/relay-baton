import * as fs from "fs";
import type { RelayBatonConfig } from "@relay-baton/shared";
import { SessionFiles } from "../session/SessionFiles";
import { GitService } from "../git/GitService";
import { UsageLedger } from "../token-diet/UsageLedger";

/**
 * v2.8 — Broadened handoff triggers. Deterministic, opt-in thresholds that
 * *suggest* relaying to the next agent even when no fallback error pattern
 * fired (the narrow idea borrowed from orchestrator tools, without their
 * resident judge-AI). Advisory only: `run` asks for confirmation (or honors
 * `--yes`); nothing here launches or halts an agent. Absent config = no-op,
 * so detection stays error-pattern-only by default.
 */

export interface HandoffTriggerHit {
  condition: "budgetRatio" | "changedFiles" | "usageTokensProxy";
  threshold: number;
  actual: number;
  message: string;
}

export interface HandoffTriggerReport {
  /** False when the config has no handoffTriggers block (policy is a no-op). */
  configured: boolean;
  triggered: boolean;
  hits: HandoffTriggerHit[];
  actual: {
    budgetRatio: number | null;
    changedFiles: number;
    usageTokensProxy: number;
  };
}

export class HandoffTriggerPolicy {
  private files: SessionFiles;
  constructor(private readonly repoRoot: string, private readonly config?: RelayBatonConfig) {
    this.files = new SessionFiles(repoRoot);
  }

  evaluate(): HandoffTriggerReport {
    const t = this.config?.handoffTriggers;
    const changedFiles = new GitService(this.repoRoot).summary(0).changed;
    const usageTokensProxy = new UsageLedger(this.repoRoot).summarize().totalTokensProxy;
    const budgetRatio = this.budgetRatio();
    const actual = { budgetRatio, changedFiles, usageTokensProxy };

    if (!t || (t.budgetRatio == null && t.changedFiles == null && t.usageTokensProxy == null)) {
      return { configured: false, triggered: false, hits: [], actual };
    }

    const hits: HandoffTriggerHit[] = [];
    if (t.budgetRatio != null && budgetRatio != null && budgetRatio >= t.budgetRatio) {
      hits.push({
        condition: "budgetRatio", threshold: t.budgetRatio, actual: budgetRatio,
        message: `handoff budget ratio ${budgetRatio.toFixed(2)} ≥ trigger ${t.budgetRatio}`,
      });
    }
    if (t.changedFiles != null && changedFiles >= t.changedFiles) {
      hits.push({
        condition: "changedFiles", threshold: t.changedFiles, actual: changedFiles,
        message: `${changedFiles} changed file(s) ≥ trigger ${t.changedFiles}`,
      });
    }
    if (t.usageTokensProxy != null && usageTokensProxy >= t.usageTokensProxy) {
      hits.push({
        condition: "usageTokensProxy", threshold: t.usageTokensProxy, actual: usageTokensProxy,
        message: `usage token proxy ${usageTokensProxy} ≥ trigger ${t.usageTokensProxy}`,
      });
    }
    return { configured: true, triggered: hits.length > 0, hits, actual };
  }

  /** handoff chars / active profile maxHandoffChars — same source as GuardrailPolicy. */
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
