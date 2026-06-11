import * as fs from "fs";
import * as path from "path";
import type { SessionMeta } from "@relay-baton/shared";
import { SESSION_DIR, SESSION_FILES, SESSION_SCHEMA_VERSION } from "@relay-baton/shared";
import { readSessionMeta } from "./SessionState";
import { GitService, type GitBaseline } from "../git/GitService";

/** Files we expect a healthy `.ai-session` to carry after `init`. */
const REQUIRED_FILES: (keyof typeof SESSION_FILES)[] = [
  "sessionJson",
  "task",
  "state",
  "compactState",
  "contextBudget",
];

export type ResumeStatus = "missing" | "incomplete" | "stale" | "ok";

export interface ResumeSuggestion {
  command: string;
  reason: string;
}

export interface ResumeMetaSummary {
  id: string | null;
  status: string | null;
  task: string | null;
  updatedAt: string | null;
  schemaVersion: number | null;
}

export interface ResumeGitSummary {
  available: boolean;
  changedSinceBaseline: boolean | null;
  headChanged: boolean | null;
  branchChanged: boolean | null;
  dirtyChanged: boolean | null;
}

export interface ResumeDiagnosis {
  sessionDir: string;
  available: boolean;
  status: ResumeStatus;
  findings: string[];
  missingFiles: string[];
  meta: ResumeMetaSummary | null;
  git: ResumeGitSummary | null;
  suggestions: ResumeSuggestion[];
}

export interface ResumeDiagnosticsOptions {
  /** Treat a session as stale when its `updatedAt` is older than this. Default 24h. */
  staleHours?: number;
  now?: Date;
}

export class ResumeDiagnostics {
  constructor(private readonly repoRoot: string) {}

  diagnose(options: ResumeDiagnosticsOptions = {}): ResumeDiagnosis {
    const sessionDir = path.join(this.repoRoot, SESSION_DIR);
    const now = options.now ?? new Date();
    const staleHours = options.staleHours ?? 24;

    if (!fs.existsSync(sessionDir) || !fs.statSync(sessionDir).isDirectory()) {
      return {
        sessionDir,
        available: false,
        status: "missing",
        findings: [`${SESSION_DIR} not found`],
        missingFiles: [],
        meta: null,
        git: null,
        suggestions: [
          { command: "init", reason: "no .ai-session in this repo; create the session scaffold first" },
        ],
      };
    }

    const findings: string[] = [];
    const missingFiles: string[] = [];
    for (const key of REQUIRED_FILES) {
      const p = path.join(sessionDir, SESSION_FILES[key]);
      if (!fs.existsSync(p)) missingFiles.push(SESSION_FILES[key]);
    }

    const metaPath = path.join(sessionDir, SESSION_FILES.sessionJson);
    const rawMeta = readSessionMeta(metaPath);
    const metaPresent = fs.existsSync(metaPath);
    const metaValid = rawMeta !== null;
    const meta = this.summarizeMeta(rawMeta);

    if (metaPresent && !metaValid) findings.push("session.json is present but could not be parsed");
    if (missingFiles.length > 0) findings.push(`missing core files: ${missingFiles.join(", ")}`);
    if (rawMeta && rawMeta.schemaVersion != null && rawMeta.schemaVersion !== SESSION_SCHEMA_VERSION) {
      findings.push(`session schemaVersion ${rawMeta.schemaVersion} != current ${SESSION_SCHEMA_VERSION}`);
    }

    const git = this.gitSummary(sessionDir);
    if (git?.changedSinceBaseline) findings.push("repository changed since the session git baseline");

    const updatedAt = rawMeta?.updatedAt ?? null;
    const ageMs = updatedAt ? now.getTime() - new Date(updatedAt).getTime() : null;
    const aged = ageMs != null && Number.isFinite(ageMs) && ageMs > staleHours * 3600_000;
    if (aged) findings.push(`session last updated ${updatedAt} (> ${staleHours}h ago)`);

    const incomplete = !metaPresent || !metaValid || missingFiles.length > 0;
    const stale = !incomplete && (aged || git?.changedSinceBaseline === true);

    let status: ResumeStatus;
    if (incomplete) status = "incomplete";
    else if (stale) status = "stale";
    else status = "ok";

    return {
      sessionDir,
      available: true,
      status,
      findings,
      missingFiles,
      meta,
      git,
      suggestions: this.suggest(status, { missingFiles, metaValid, metaPresent, git }),
    };
  }

  private suggest(
    status: ResumeStatus,
    ctx: { missingFiles: string[]; metaValid: boolean; metaPresent: boolean; git: ResumeGitSummary | null },
  ): ResumeSuggestion[] {
    if (status === "ok") {
      return [
        { command: "status", reason: "session looks healthy; review current state" },
        { command: "replay", reason: "read the recorded conversation timeline to resume context" },
      ];
    }

    if (status === "incomplete") {
      const out: ResumeSuggestion[] = [];
      if (!ctx.metaPresent || !ctx.metaValid || ctx.missingFiles.length > 0) {
        out.push({ command: "init", reason: "re-scaffold missing .ai-session files (idempotent, never overwrites)" });
      }
      out.push({ command: "status", reason: "inspect whatever session state already exists" });
      return out;
    }

    // stale
    const out: ResumeSuggestion[] = [
      { command: "status", reason: "confirm where the session stands before resuming" },
    ];
    if (ctx.git?.changedSinceBaseline) {
      out.push({ command: "review", reason: "the repo moved since the baseline; review the current diff" });
    }
    out.push({ command: "handoff", reason: "regenerate a compact handoff to hand the work off cleanly" });
    out.push({ command: "session archive", reason: "snapshot the current .ai-session before continuing" });
    return out;
  }

  private summarizeMeta(meta: SessionMeta | null): ResumeMetaSummary | null {
    if (!meta) return null;
    return {
      id: meta.id ?? null,
      status: meta.status ?? null,
      task: meta.task ?? null,
      updatedAt: meta.updatedAt ?? null,
      schemaVersion: meta.schemaVersion ?? null,
    };
  }

  private gitSummary(sessionDir: string): ResumeGitSummary | null {
    const git = new GitService(this.repoRoot);
    if (!git.isGitRepo()) return { available: false, changedSinceBaseline: null, headChanged: null, branchChanged: null, dirtyChanged: null };
    const baseline = this.readBaseline(sessionDir);
    const cmp = git.compareBaseline(baseline);
    return {
      available: true,
      changedSinceBaseline: cmp.changedSinceBaseline,
      headChanged: cmp.headChanged,
      branchChanged: cmp.branchChanged,
      dirtyChanged: cmp.dirtyChanged,
    };
  }

  private readBaseline(sessionDir: string): GitBaseline | null {
    const p = path.join(sessionDir, SESSION_FILES.gitBaseline);
    if (!fs.existsSync(p)) return null;
    try {
      return JSON.parse(fs.readFileSync(p, "utf8")) as GitBaseline;
    } catch {
      return null;
    }
  }
}
