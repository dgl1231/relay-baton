import * as fs from "fs";
import * as path from "path";
import type { DietProfile, RelayBatonConfig } from "@relay-baton/shared";
import { SessionFiles } from "../session/SessionFiles";
import { StateCompactor } from "./StateCompactor";
import { LogCompactor } from "./LogCompactor";

export interface ContextWeight {
  state: number;
  commandsLog: number;
  decisions: number;
  errors: number;
  total: number;
  /** Sum of the relevant profile budgets used as the denominator. */
  budget: number;
  /** total / budget. */
  ratio: number;
}

export interface CompressionResult {
  compressed: boolean;
  reason: string;
  before: ContextWeight;
  after?: ContextWeight;
  rotatedLog?: string;
  rolledBack?: boolean;
  gateFailures?: string[];
}

function readSafe(p: string): string {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

export class ContextCompressor {
  constructor(private repoRoot: string, private config: RelayBatonConfig) {}

  private files() { return new SessionFiles(this.repoRoot); }

  weigh(profile: DietProfile): ContextWeight {
    const f = this.files();
    const state = readSafe(f.p("state")).length;
    const commandsLog = readSafe(f.p("commandsLog")).length;
    const decisions = readSafe(f.p("decisions")).length;
    const errors = readSafe(f.p("errors")).length;
    const total = state + commandsLog + decisions + errors;
    // Budget: state budget + a generous log allowance (log tail budget x a factor).
    const budget = (profile.maxStateChars ?? 6000) + (profile.maxLogTailChars ?? 5000) * 4;
    return { state, commandsLog, decisions, errors, total, budget, ratio: budget > 0 ? total / budget : 0 };
  }

  /**
   * Compress running context if over threshold (or always when force=true).
   * Deterministic: StateCompactor on state.md, LogCompactor.compressLog on
   * commands.log, raw log rotated to commands.log.full.<ts>. Verified by an
   * inline gate; rolls back the log on gate failure.
   */
  compressIfNeeded(profile: DietProfile, opts: { force?: boolean; threshold?: number; dryRun?: boolean } = {}): CompressionResult {
    const f = this.files();
    const before = this.weigh(profile);
    const threshold = opts.threshold ?? this.config.contextCompression?.threshold ?? 0.8;

    if (!opts.force && before.ratio < threshold) {
      return { compressed: false, reason: `under threshold (${before.ratio.toFixed(2)} < ${threshold})`, before };
    }
    if (opts.dryRun) {
      return { compressed: false, reason: `would compress (ratio ${before.ratio.toFixed(2)} >= ${threshold})`, before };
    }

    const rawLog = readSafe(f.p("commandsLog"));
    const stateMd = readSafe(f.p("state"));

    // 1) compress state.md
    if (stateMd.trim().length > 0) {
      const compactState = new StateCompactor().compact(stateMd, profile.maxStateChars);
      fs.writeFileSync(f.p("state"), compactState, "utf8");
    }

    // 2) rotate + compress commands.log
    let rotatedLog: string | undefined;
    if (rawLog.length > 0) {
      if (this.config.contextCompression?.rotateRawArtifacts !== false) {
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        rotatedLog = path.join(f.dir, `commands.log.full.${ts}`);
        fs.writeFileSync(rotatedLog, rawLog, "utf8");
      }
      const compressedLog = new LogCompactor().compressLog(rawLog, {
        fallbackPatterns: this.config.fallbackPatterns,
      });
      fs.writeFileSync(f.p("commandsLog"), compressedLog, "utf8");
    }

    // 3) gate: did we actually shrink, does state still parse, does the last
    //    fallback hit survive?
    const after = this.weigh(profile);
    const gateFailures = this.gate(before, after, rawLog);
    if (gateFailures.length > 0) {
      // rollback the log from the rotated raw copy
      if (rotatedLog && fs.existsSync(rotatedLog)) {
        fs.copyFileSync(rotatedLog, f.p("commandsLog"));
      }
      return { compressed: false, reason: "gate failed; rolled back", before, after, rotatedLog, rolledBack: true, gateFailures };
    }

    return { compressed: true, reason: "compressed", before, after, rotatedLog };
  }

  /** Inline ContextCompressionGate. Returns failure strings (empty = ok). */
  gate(before: ContextWeight, after: ContextWeight, rawLog: string): string[] {
    const f = this.files();
    const failures: string[] = [];

    // must actually shrink
    if (after.total >= before.total) {
      failures.push(`no reduction (before ${before.total} <= after ${after.total})`);
    }

    // state.md still parses into the canonical compact-state shape
    const state = readSafe(f.p("state"));
    if (state.trim().length > 0 && !/##\s+Goal/.test(state) && !/#\s+Compact State/.test(state)) {
      failures.push("state.md no longer has a recognizable Goal/Compact State structure");
    }

    // last fallback hit must survive in the compressed log
    const lowers = (this.config.fallbackPatterns ?? []).map(p => p.toLowerCase());
    const lastHit = this.lastFallbackHit(rawLog, lowers);
    if (lastHit) {
      const compressed = readSafe(f.p("commandsLog")).toLowerCase();
      if (!compressed.includes(lastHit)) {
        failures.push("compressed commands.log dropped the last fallback-pattern hit");
      }
    }

    return failures;
  }

  private lastFallbackHit(rawLog: string, lowers: string[]): string | null {
    if (lowers.length === 0) return null;
    const lines = rawLog.split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i--) {
      const low = lines[i].toLowerCase();
      for (const p of lowers) if (low.includes(p)) return p;
    }
    return null;
  }
}
