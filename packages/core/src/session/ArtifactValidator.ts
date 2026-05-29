import * as fs from "fs";
import type { SessionMeta } from "@relay-baton/shared";
import { SESSION_FILES } from "@relay-baton/shared";
import { SessionFiles } from "./SessionFiles";
import { validateSessionMeta } from "./SessionMetaSchema";

export interface ArtifactCheck {
  /** Logical artifact key (SESSION_FILES key). */
  artifact: string;
  /** File name on disk. */
  file: string;
  status: "ok" | "warn" | "fail" | "absent";
  detail: string;
}

export interface ArtifactReport {
  sessionDir: string;
  exists: boolean;
  checks: ArtifactCheck[];
  ok: boolean;
}

function readSafe(p: string): string | null {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

/**
 * v1.0 `.ai-session/` stability check. Deterministic and read-only: it
 * validates the *shape* of the artifacts relay-baton guarantees (JSON parses,
 * session.json matches the SessionMeta contract, conversation.jsonl lines are
 * valid JSON). Markdown artifacts are only checked for existence — their
 * content is intentionally free-form. Never spawns; never mutates.
 */
export function validateArtifacts(repoRoot: string): ArtifactReport {
  const files = new SessionFiles(repoRoot);
  const checks: ArtifactCheck[] = [];
  const exists = fs.existsSync(files.dir);
  if (!exists) {
    return { sessionDir: files.dir, exists: false, checks, ok: true };
  }

  // session.json — must parse and satisfy the SessionMeta contract.
  {
    const file = SESSION_FILES.sessionJson;
    const raw = readSafe(files.p("sessionJson"));
    if (raw === null) {
      checks.push({ artifact: "sessionJson", file, status: "absent", detail: "not present" });
    } else {
      try {
        const meta = JSON.parse(raw) as SessionMeta;
        const r = validateSessionMeta(meta);
        checks.push({
          artifact: "sessionJson", file,
          status: r.ok ? "ok" : "fail",
          detail: r.ok ? `valid (status=${meta.status})` : r.errors.join("; "),
        });
      } catch (e: any) {
        checks.push({ artifact: "sessionJson", file, status: "fail", detail: `unparseable JSON: ${e?.message ?? e}` });
      }
    }
  }

  // context-budget.json — must parse as JSON when present.
  {
    const file = SESSION_FILES.contextBudget;
    const raw = readSafe(files.p("contextBudget"));
    if (raw === null) {
      checks.push({ artifact: "contextBudget", file, status: "absent", detail: "not present" });
    } else if (raw.trim() === "") {
      checks.push({ artifact: "contextBudget", file, status: "warn", detail: "empty" });
    } else {
      try { JSON.parse(raw); checks.push({ artifact: "contextBudget", file, status: "ok", detail: "valid JSON" }); }
      catch (e: any) { checks.push({ artifact: "contextBudget", file, status: "fail", detail: `unparseable JSON: ${e?.message ?? e}` }); }
    }
  }

  // conversation.jsonl — every non-empty line must be valid JSON.
  {
    const file = SESSION_FILES.conversation;
    const raw = readSafe(files.p("conversation"));
    if (raw === null) {
      checks.push({ artifact: "conversation", file, status: "absent", detail: "not present" });
    } else {
      const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      let bad = 0;
      for (const l of lines) { try { JSON.parse(l); } catch { bad++; } }
      checks.push({
        artifact: "conversation", file,
        status: bad === 0 ? "ok" : "fail",
        detail: bad === 0 ? `${lines.length} event(s), all valid` : `${bad}/${lines.length} malformed line(s)`,
      });
    }
  }

  const ok = checks.every(c => c.status !== "fail");
  return { sessionDir: files.dir, exists: true, checks, ok };
}
