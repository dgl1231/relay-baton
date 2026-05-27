import * as fs from "fs";
import type { DietProfile, DietProfileName } from "@relay-baton/shared";
import { TRUNCATE_MARKER } from "@relay-baton/shared";
import { SessionFiles } from "../session/SessionFiles";

export interface TokenDietGateResult { ok: boolean; failures: string[]; warnings: string[]; }

export class TokenDietQualityGate {
  constructor(private repoRoot: string, private profileName: DietProfileName, private profile: DietProfile) {}

  check(opts: { wasTruncated: boolean }): TokenDietGateResult {
    const f = new SessionFiles(this.repoRoot);
    const failures: string[] = [];
    const warnings: string[] = [];

    const read = (key: Parameters<SessionFiles["p"]>[0], label: string): string => {
      const p = f.p(key);
      if (!fs.existsSync(p)) { failures.push(`${label}: missing ${p}`); return ""; }
      return fs.readFileSync(p, "utf8");
    };

    const handoff = read("handoff", "handoff.md");
    read("fullDiff", "full-diff.patch");
    read("compactState", "compact-state.md");
    read("contextBudget", "context-budget.json");

    if (handoff.length > this.profile.maxHandoffChars) {
      failures.push(`handoff.md ${handoff.length} > maxHandoffChars ${this.profile.maxHandoffChars}`);
    }
    if (!handoff.includes("## Token Diet Summary")) {
      failures.push("handoff.md missing Token Diet Summary section");
    }
    if (opts.wasTruncated && !handoff.includes(TRUNCATE_MARKER)) {
      warnings.push("Content was truncated but no TRUNCATED marker present in handoff.md");
    }

    const commandsLog = (() => { try { return fs.readFileSync(f.p("commandsLog"), "utf8"); } catch { return ""; }})();
    if (commandsLog.length > 200 && handoff.includes(commandsLog.slice(0, 200))) {
      failures.push("handoff.md inlines large portion of commands.log");
    }

    const inlineCheck = (file: string) => {
      try {
        const text = fs.readFileSync(file, "utf8");
        if (text.length > 200 && handoff.includes(text.slice(0, 200))) {
          failures.push(`handoff.md inlines ${file}; reference it instead.`);
        }
      } catch { /* missing fine */ }
    };
    inlineCheck("AGENTS.md");
    inlineCheck("CLAUDE.md");

    if (this.profileName === "caveman" || this.profileName === "ultra") {
      const m = /## Important Diff\s+([\s\S]*?)(?=\n## |\n# |$)/.exec(handoff);
      const diffBlock = m?.[1] ?? "";
      if (diffBlock.length > this.profile.maxDiffChars) {
        failures.push(`${this.profileName} profile: Important Diff block too large (${diffBlock.length} > ${this.profile.maxDiffChars})`);
      }
    }

    if (this.profileName === "ultra") {
      for (const low of ["## Full Diff", "## Long Logs", "## Full Git Status"]) {
        if (handoff.includes(low)) warnings.push(`ultra profile should avoid section ${low}`);
      }
    }

    return { ok: failures.length === 0, failures, warnings };
  }
}
