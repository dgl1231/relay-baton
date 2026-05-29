import type { SessionMeta, SessionStatus, AgentId } from "@relay-baton/shared";
import { SESSION_SCHEMA_VERSION } from "@relay-baton/shared";
import type { ValidationResult } from "../config/ConfigSchema";

const STATUSES: ReadonlySet<string> = new Set<SessionStatus>([
  "initialized", "running", "fallback_detected", "handoff_ready", "running_fallback",
  "planning", "plan_ready", "executing", "compressing", "completed", "failed",
]);

const AGENT_OR_NONE: ReadonlySet<string> = new Set<AgentId | "none">([
  "codex", "claude", "opencode", "gemini", "aider", "none",
]);

/**
 * v1.0 frozen SessionMeta contract validator. Deterministic and pure.
 * Verifies the required identity/lifecycle fields and the enum domains; the
 * many optional observability fields are checked only when present.
 */
export function validateSessionMeta(meta: SessionMeta): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const v = meta.schemaVersion ?? 1;
  if (!Number.isInteger(v) || v < 1) {
    errors.push(`schemaVersion must be a positive integer (got ${meta.schemaVersion})`);
  } else if (v > SESSION_SCHEMA_VERSION) {
    warnings.push(`schemaVersion ${v} is newer than supported ${SESSION_SCHEMA_VERSION}`);
  }

  if (!meta.id) errors.push("id is required");
  for (const f of ["createdAt", "updatedAt", "repoRoot"] as const) {
    if (!meta[f]) errors.push(`${f} is required`);
  }
  if (!STATUSES.has(meta.status)) errors.push(`status is not a known SessionStatus: ${meta.status}`);
  for (const f of ["primaryAgent", "fallbackAgent", "activeAgent", "lastAgent"] as const) {
    if (!AGENT_OR_NONE.has(meta[f])) errors.push(`${f} is not a known agent: ${meta[f]}`);
  }

  if (meta.durationMs !== undefined && (typeof meta.durationMs !== "number" || meta.durationMs < 0)) {
    errors.push(`durationMs must be a non-negative number (got ${meta.durationMs})`);
  }
  if (meta.handoffCount !== undefined && (!Number.isInteger(meta.handoffCount) || meta.handoffCount < 0)) {
    errors.push(`handoffCount must be a non-negative integer (got ${meta.handoffCount})`);
  }
  if (meta.workflowMode !== undefined && meta.workflowMode !== "fallback" && meta.workflowMode !== "plan-execute") {
    errors.push(`workflowMode must be "fallback" or "plan-execute" (got ${meta.workflowMode})`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Stamp the current schema version onto a (possibly legacy) SessionMeta. */
export function normalizeSessionMeta(meta: SessionMeta): SessionMeta {
  if (meta.schemaVersion === SESSION_SCHEMA_VERSION) return meta;
  return { ...meta, schemaVersion: SESSION_SCHEMA_VERSION };
}
