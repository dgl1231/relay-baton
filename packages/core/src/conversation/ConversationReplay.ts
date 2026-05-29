import type { ConversationEvent } from "@relay-baton/shared";
import { ConversationLog } from "./ConversationLog";

/** One rendered line in a replay timeline. Pure/derived from an event. */
export interface ReplayEntry {
  index: number;
  ts: string;
  role: ConversationEvent["role"];
  kind: ConversationEvent["kind"];
  text: string;
  agent?: string;
  confirmed?: boolean;
  refs?: Record<string, string>;
}

export interface ReplaySummary {
  total: number;
  byRole: Record<string, number>;
  byKind: Record<string, number>;
  firstTs?: string;
  lastTs?: string;
}

export interface ReplayResult {
  entries: ReplayEntry[];
  summary: ReplaySummary;
}

export interface ReplayFilter {
  /** Only include events for this session id. */
  sessionId?: string;
  /** Only include these kinds. */
  kinds?: ConversationEvent["kind"][];
  /** Cap the number of entries (most recent kept). */
  limit?: number;
}

/**
 * Pure, model-free session replay. Reads `.ai-session/conversation.jsonl`
 * and projects the append-only event log into an ordered timeline plus a
 * deterministic summary. It never spawns an agent and never mutates state.
 */
export class ConversationReplay {
  private log: ConversationLog;
  constructor(repoRoot: string) {
    this.log = new ConversationLog(repoRoot);
  }

  build(filter: ReplayFilter = {}): ReplayResult {
    let events = this.log.read();
    if (filter.sessionId !== undefined) {
      events = events.filter((e) => e.sessionId === filter.sessionId);
    }
    if (filter.kinds && filter.kinds.length > 0) {
      const set = new Set(filter.kinds);
      events = events.filter((e) => set.has(e.kind));
    }
    if (filter.limit !== undefined && filter.limit >= 0 && events.length > filter.limit) {
      events = events.slice(events.length - filter.limit);
    }

    const entries: ReplayEntry[] = events.map((e, i) => ({
      index: i + 1,
      ts: e.ts,
      role: e.role,
      kind: e.kind,
      text: e.text,
      agent: e.meta?.agent,
      confirmed: e.meta?.confirmed,
      refs: e.refs,
    }));

    const byRole: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    for (const e of events) {
      byRole[e.role] = (byRole[e.role] ?? 0) + 1;
      byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
    }

    return {
      entries,
      summary: {
        total: events.length,
        byRole,
        byKind,
        firstTs: events[0]?.ts,
        lastTs: events[events.length - 1]?.ts,
      },
    };
  }

  /** Token-diet-friendly one-line-per-event rendering. */
  renderLines(filter: ReplayFilter = {}): string[] {
    return this.build(filter).entries.map((e) => {
      const who = e.agent && e.agent !== e.role ? `${e.role}/${e.agent}` : e.role;
      return `${e.index}. [${e.ts}] ${who} ${e.kind}: ${e.text}`;
    });
  }
}
