import * as fs from "fs";
import type { RelayBatonConfig } from "@relay-baton/shared";
import { SessionFiles } from "../session/SessionFiles";
import { GitBaseline, GitService, GitSummary, GitBaselineComparison } from "../git/GitService";
import { planSectionBody } from "./PlanSchema";

export interface ReviewStep {
  /** 1-based index within the Steps section. */
  index: number;
  text: string;
  /** File-path-like tokens referenced by this step. */
  referencedPaths: string[];
  /** Changed files that match this step's referenced paths. */
  matchedFiles: string[];
  /** True when at least one referenced path matches a changed file. */
  touched: boolean;
}

export interface ReviewResult {
  planPresent: boolean;
  /** All steps parsed from the plan's Steps section. */
  steps: ReviewStep[];
  /** Files git reports as changed (tracked diff + untracked). */
  changedFiles: string[];
  /** Changed files not referenced by any step ("unplanned" changes). */
  unplannedFiles: string[];
  /** Steps whose referenced paths were all touched. */
  touchedSteps: number;
  /** Steps with at least one referenced path but none touched yet. */
  untouchedSteps: number;
  /** Steps that referenced no file path at all (cannot be correlated). */
  uncorrelatedSteps: number;
  /** First non-empty line of test-results.md, or null. */
  testResultsSummary: string | null;
  handoffPresent: boolean;
  git: {
    summary: Pick<GitSummary, "available" | "branch" | "head" | "clean" | "changed" | "staged" | "unstaged" | "untracked">;
    tracking: GitBaselineComparison;
  };
}

function readSafe(p: string): string {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

function readJsonSafe<T>(p: string): T | null {
  try { return JSON.parse(fs.readFileSync(p, "utf8")) as T; } catch { return null; }
}

/**
 * Extract file-path-like tokens from a step line. Deterministic, no model:
 *  - backtick-quoted spans (`packages/core/foo.ts`)
 *  - bare tokens containing a slash or a dotted extension.
 */
export function extractPaths(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/`([^`]+)`/g)) {
    const t = m[1].trim();
    if (t) out.add(t);
  }
  for (const m of text.matchAll(/(?:^|[\s(])([A-Za-z0-9_./-]*[\/.][A-Za-z0-9_./-]+)/g)) {
    const t = m[1].trim().replace(/[.,;:]+$/, "");
    // require either a slash (path) or a dotted file extension
    if (/\//.test(t) || /\.[A-Za-z0-9]{1,8}$/.test(t)) out.add(t);
  }
  return [...out];
}

/** Parse numbered/bulleted lines from the Steps section. */
export function parseSteps(planMd: string): { index: number; text: string }[] {
  const body = planSectionBody(planMd, "Steps");
  const steps: { index: number; text: string }[] = [];
  let i = 0;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const stripped = line.replace(/^(\d+\.|[-*])\s*/, "").trim();
    if (stripped.length === 0) continue;
    if (/^\(.*\)$/.test(stripped)) continue; // template placeholder
    steps.push({ index: ++i, text: stripped });
  }
  return steps;
}

function matches(referenced: string, changed: string): boolean {
  const r = referenced.replace(/\\/g, "/").toLowerCase();
  const c = changed.replace(/\\/g, "/").toLowerCase();
  if (r === c) return true;
  // a referenced path is a suffix of a changed path, or vice versa, or one
  // is a basename of the other.
  if (c.endsWith("/" + r) || r.endsWith("/" + c)) return true;
  const cBase = c.split("/").pop() ?? c;
  const rBase = r.split("/").pop() ?? r;
  if (cBase === rBase && cBase.includes(".")) return true;
  return false;
}

/**
 * Deterministic review of the working-tree diff against the current plan.
 * No model call. Correlates plan Steps to changed files by path tokens.
 */
export class PlanReview {
  constructor(private repoRoot: string, private config: RelayBatonConfig) {}

  run(): ReviewResult {
    const files = new SessionFiles(this.repoRoot);
    const planMd = readSafe(files.p("plan"));
    const planPresent = planMd.trim().length > 0;

    const git = new GitService(this.repoRoot);
    const changedFiles = git.isGitRepo() ? git.changedFiles() : [];
    const gitSummary = git.summary(20);
    const gitTracking = git.compareBaseline(readJsonSafe<GitBaseline>(files.p("gitBaseline")));

    const parsed = parseSteps(planMd);
    const referencedAll = new Set<string>();
    const steps: ReviewStep[] = parsed.map(s => {
      const referencedPaths = extractPaths(s.text);
      for (const p of referencedPaths) referencedAll.add(p);
      const matchedFiles = changedFiles.filter(cf => referencedPaths.some(rp => matches(rp, cf)));
      return {
        index: s.index,
        text: s.text,
        referencedPaths,
        matchedFiles,
        touched: matchedFiles.length > 0,
      };
    });

    const unplannedFiles = changedFiles.filter(cf =>
      !steps.some(st => st.matchedFiles.includes(cf)),
    );

    const touchedSteps = steps.filter(s => s.touched).length;
    const uncorrelatedSteps = steps.filter(s => s.referencedPaths.length === 0).length;
    const untouchedSteps = steps.filter(s => !s.touched && s.referencedPaths.length > 0).length;

    const testResults = readSafe(files.p("testResults"));
    let testResultsSummary: string | null = null;
    for (const l of testResults.split(/\r?\n/)) {
      const t = l.replace(/^#+\s*/, "").trim();
      if (t) { testResultsSummary = t; break; }
    }

    return {
      planPresent,
      steps,
      changedFiles,
      unplannedFiles,
      touchedSteps,
      untouchedSteps,
      uncorrelatedSteps,
      testResultsSummary,
      handoffPresent: fs.existsSync(files.p("handoff")),
      git: {
        summary: {
          available: gitSummary.available,
          branch: gitSummary.branch,
          head: gitSummary.head,
          clean: gitSummary.clean,
          changed: gitSummary.changed,
          staged: gitSummary.staged,
          unstaged: gitSummary.unstaged,
          untracked: gitSummary.untracked,
        },
        tracking: gitTracking,
      },
    };
  }
}
