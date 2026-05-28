import * as fs from "fs";
import * as path from "path";
import { SessionFiles } from "@relay-baton/core";
import { SESSION_DIR } from "@relay-baton/shared";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

/**
 * Returns the first non-empty line of `content`, trimmed and clipped to
 * `maxLen` characters. Skips the leading `#` heading markers so the label
 * is more descriptive (e.g. "Relay Baton Handoff" instead of "#").
 */
export function firstNonEmptyLine(content: string, maxLen = 80): string {
  for (const raw of content.split(/\r?\n/)) {
    const trimmed = raw.replace(/^#+\s*/, "").trim();
    if (trimmed.length === 0) continue;
    return trimmed.length > maxLen ? trimmed.slice(0, maxLen - 1) + "…" : trimmed;
  }
  return "(empty)";
}

export interface HandoffHistoryEntry {
  /** Filename inside `.ai-session/` — e.g. "handoff.md" or "handoff.2026-...md" */
  name: string;
  /** Absolute path on disk. */
  path: string;
  /** Modification time in milliseconds since epoch. */
  mtimeMs: number;
  /** File size in bytes. */
  size: number;
  /** First non-empty content line, used as a row label. */
  label: string;
  /** True when this is the current `handoff.md` (not a backup). */
  current: boolean;
}

// SessionManager.backupHandoffIfExists writes:
//   handoff.<ISO-with-:-and-.-replaced-by-->.md
// e.g.  handoff.2026-05-27T05-58-13-213Z.md
// So the timestamp piece can contain digits, dashes, and a trailing 'Z'.
const BACKUP_NAME_RE = /^handoff\.\d{4}-\d{2}-\d{2}T[\dZ-]+\.md$/;
const CURRENT_NAME = "handoff.md";

export function collectHandoffHistory(repoRoot: string): HandoffHistoryEntry[] {
  const files = new SessionFiles(repoRoot);
  if (!fs.existsSync(files.dir)) return [];

  const entries: HandoffHistoryEntry[] = [];
  for (const name of fs.readdirSync(files.dir)) {
    const isCurrent = name === CURRENT_NAME;
    const isBackup = BACKUP_NAME_RE.test(name);
    if (!isCurrent && !isBackup) continue;

    const full = path.join(files.dir, name);
    let stat: fs.Stats;
    try { stat = fs.statSync(full); } catch { continue; }
    if (!stat.isFile()) continue;

    let label = "(unreadable)";
    try { label = firstNonEmptyLine(fs.readFileSync(full, "utf8")); } catch { /* keep default */ }

    entries.push({
      name,
      path: full,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      label,
      current: isCurrent,
    });
  }
  // newest first
  entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return entries;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / 1024 / 1024).toFixed(1)}M`;
}

function fmtTimestamp(mtimeMs: number): string {
  // ISO-like compact form, no milliseconds.
  return new Date(mtimeMs).toISOString().replace(/\.\d+Z$/, "Z");
}

export async function handoffHistoryCommand(opts: ProjectOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const entries = collectHandoffHistory(repoRoot);
  if (entries.length === 0) {
    console.log(`[relay-baton] no handoff history under ${SESSION_DIR}/`);
    return;
  }
  // Print a small header so the columns are obvious.
  console.log("  TIMESTAMP             SIZE   FILE                                 LABEL");
  for (const e of entries) {
    const marker = e.current ? "*" : " ";
    const ts = fmtTimestamp(e.mtimeMs).padEnd(20);
    const sz = fmtSize(e.size).padStart(6);
    const name = e.name.length > 36 ? e.name.slice(0, 35) + "…" : e.name.padEnd(36);
    console.log(`${marker} ${ts}  ${sz}  ${name}  ${e.label}`);
  }
}
