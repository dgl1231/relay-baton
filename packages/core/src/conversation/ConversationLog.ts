import * as fs from "fs";
import * as crypto from "crypto";
import type {
  ConversationEvent,
  ConversationEventKind,
  ConversationRole,
} from "@relay-baton/shared";
import { ARTIFACT_SCHEMA_VERSIONS } from "@relay-baton/shared";
import { SessionFiles } from "../session/SessionFiles";

export interface AppendEventInput {
  role: ConversationRole;
  kind: ConversationEventKind;
  text: string;
  sessionId?: string;
  refs?: Record<string, string>;
  meta?: ConversationEvent["meta"];
}

/**
 * Append-only conversation event log (v0.7 draft; Agent Room groundwork).
 * Stores one JSON object per line in `.ai-session/conversation.jsonl`.
 * Events are never rewritten — corrections are new events. `text` must be a
 * token-diet-friendly summary; large content stays in its own artifact and is
 * referenced via `refs`.
 */
export class ConversationLog {
  private files: SessionFiles;
  constructor(repoRoot: string) {
    this.files = new SessionFiles(repoRoot);
  }

  private path(): string {
    return this.files.p("conversation");
  }

  append(input: AppendEventInput): ConversationEvent {
    const event: ConversationEvent = {
      schemaVersion: ARTIFACT_SCHEMA_VERSIONS.conversation,
      id: `evt_${crypto.randomUUID()}`,
      ts: new Date().toISOString(),
      sessionId: input.sessionId,
      role: input.role,
      kind: input.kind,
      text: input.text,
      refs: input.refs,
      meta: input.meta,
    };
    // Best-effort: only write if the session dir exists; never throw on a
    // logging failure (it must not break the underlying command).
    try {
      if (fs.existsSync(this.files.dir)) {
        fs.appendFileSync(this.path(), JSON.stringify(event) + "\n", "utf8");
      }
    } catch {
      /* logging is best-effort */
    }
    return event;
  }

  /** Read and parse all events. Skips malformed lines defensively. */
  read(): ConversationEvent[] {
    let raw = "";
    try { raw = fs.readFileSync(this.path(), "utf8"); } catch { return []; }
    const out: ConversationEvent[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      try { out.push(JSON.parse(t) as ConversationEvent); } catch { /* skip bad line */ }
    }
    return out;
  }
}
