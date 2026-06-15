import * as fs from "fs";
import type { RelayBatonConfig } from "@relay-baton/shared";
import { SessionFiles } from "../session/SessionFiles";
import { GitService } from "../git/GitService";

export type CheckpointResult = "ok" | "fail" | "pending";

export interface CheckpointGitSnapshot {
  available: boolean;
  branch: string | null;
  head: string | null;
  clean: boolean;
  changed: number;
}

export interface CheckpointBudgetSnapshot {
  activeProfile: string;
  maxHandoffChars: number;
  handoffChars: number;
}

export interface ExecutionCheckpoint {
  schemaVersion: 1;
  step: number;
  ts: string;
  command: string;
  result: CheckpointResult;
  note: string;
  changedFiles: string[];
  git: CheckpointGitSnapshot;
  budget: CheckpointBudgetSnapshot | null;
}

export interface CheckpointSummary {
  total: number;
  results: { ok: number; fail: number; pending: number };
  lastStep: number | null;
  lastCommand: string;
  lastResult: CheckpointResult | null;
  maxChangedFiles: number;
  latestBudget: CheckpointBudgetSnapshot | null;
  firstTs: string | null;
  lastTs: string | null;
}

export interface CheckpointInput {
  step: number;
  command?: string;
  result?: CheckpointResult;
  note?: string;
  now?: Date;
  /** Cap how many changed file paths are recorded. Default 40. */
  maxFiles?: number;
}

/**
 * Append-only execution checkpoints for the guarded execution workflow. Each
 * bounded execute step appends one JSON line to `.ai-session/checkpoints.jsonl`
 * capturing a deterministic, read-only snapshot: command preview, changed
 * files, git summary, budget, and result. Checkpoints are never rewritten — a
 * correction is a new checkpoint. No model calls.
 */
export class ExecutionCheckpoints {
  private files: SessionFiles;
  constructor(private readonly repoRoot: string, private readonly config?: RelayBatonConfig) {
    this.files = new SessionFiles(repoRoot);
  }

  append(input: CheckpointInput): ExecutionCheckpoint {
    const now = input.now ?? new Date();
    const maxFiles = input.maxFiles ?? 40;
    const git = new GitService(this.repoRoot);
    const summary = git.summary(maxFiles);

    const checkpoint: ExecutionCheckpoint = {
      schemaVersion: 1,
      step: input.step,
      ts: now.toISOString(),
      command: (input.command ?? "").trim(),
      result: input.result ?? "pending",
      note: (input.note ?? "").trim(),
      changedFiles: summary.files.slice(0, maxFiles).map(f => f.path),
      git: {
        available: summary.available,
        branch: summary.branch,
        head: summary.head,
        clean: summary.clean,
        changed: summary.changed,
      },
      budget: this.budgetSnapshot(),
    };

    const line = JSON.stringify(checkpoint) + "\n";
    fs.appendFileSync(this.files.p("checkpoints"), line, "utf8");
    return checkpoint;
  }

  /**
   * Compact, handoff/archive/review-ready receipt derived from the recorded
   * checkpoints. Deterministic — no model calls.
   */
  summarize(): CheckpointSummary {
    const all = this.list();
    const results = { ok: 0, fail: 0, pending: 0 };
    let maxChangedFiles = 0;
    for (const c of all) {
      results[c.result] += 1;
      if (c.changedFiles.length > maxChangedFiles) maxChangedFiles = c.changedFiles.length;
    }
    const last = all[all.length - 1] ?? null;
    return {
      total: all.length,
      results,
      lastStep: last?.step ?? null,
      lastCommand: last?.command ?? "",
      lastResult: last?.result ?? null,
      maxChangedFiles,
      latestBudget: last?.budget ?? null,
      firstTs: all[0]?.ts ?? null,
      lastTs: last?.ts ?? null,
    };
  }

  /** Parse all recorded checkpoints, tolerant of malformed lines. */
  list(): ExecutionCheckpoint[] {
    let body = "";
    try { body = fs.readFileSync(this.files.p("checkpoints"), "utf8"); } catch { return []; }
    const out: ExecutionCheckpoint[] = [];
    for (const raw of body.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line) as ExecutionCheckpoint;
        if (parsed && typeof parsed.step === "number") out.push(parsed);
      } catch { /* skip malformed line */ }
    }
    return out;
  }

  private budgetSnapshot(): CheckpointBudgetSnapshot | null {
    if (!this.config) return null;
    const read = (p: string) => { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } };
    let activeProfile = this.config.tokenDiet.profile;
    try {
      const meta = JSON.parse(read(this.files.p("sessionJson")));
      if (meta?.tokenDietProfile) activeProfile = meta.tokenDietProfile;
    } catch { /* use config default */ }
    const profile = this.config.tokenDiet.profiles[activeProfile];
    if (!profile) return null;
    return {
      activeProfile,
      maxHandoffChars: profile.maxHandoffChars,
      handoffChars: read(this.files.p("handoff")).length,
    };
  }
}
