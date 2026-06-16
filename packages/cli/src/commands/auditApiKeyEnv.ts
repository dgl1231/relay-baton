import { ConversationLog } from "@relay-baton/core";

/**
 * Record an audit trail when blocked provider key env vars were intentionally
 * passed through to a child agent (via `--allow-api-key-env`). Names only — the
 * values are never read, logged, or stored.
 */
export function auditApiKeyEnv(repoRoot: string, passedThrough: string[] | undefined, sessionId?: string): void {
  if (!passedThrough || passedThrough.length === 0) return;
  const names = passedThrough.join(", ");
  console.error(`[relay-baton] audit: passed API key env to child (names only): ${names}`);
  try {
    new ConversationLog(repoRoot).append({
      role: "relay-baton",
      kind: "status",
      text: `audit: API key env passed to child via --allow-api-key-env: ${names} (names only; values never logged)`,
      sessionId,
      meta: { confirmed: true },
    });
  } catch {
    /* audit logging is best-effort */
  }
}
