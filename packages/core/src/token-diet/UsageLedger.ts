import * as fs from "fs";
import * as path from "path";
import { SESSION_DIR, SESSION_FILES } from "@relay-baton/shared";
import type { AgentId } from "@relay-baton/shared";

/**
 * v2.4 — Local usage insight. A deterministic, append-only ledger of per-session
 * token/quota *proxy* accounting, for budgeting only. This is NOT a real
 * tokenizer (CLAUDE.md forbids that) — the proxy is `ceil(chars / 4)`, a stable
 * rough estimate. Everything stays on disk in `.ai-session/usage.jsonl` and is
 * never transmitted anywhere.
 */

export type UsageEventType = "run" | "handoff";

export interface UsageEvent {
  ts: string;
  type: UsageEventType;
  /** The agent this spend is attributed to (or "none"). */
  agent: AgentId | "none";
  /** Raw characters accounted for this event. */
  chars: number;
  /** Token proxy = ceil(chars / 4). Not a real tokenizer. */
  tokensProxy: number;
  /** Optional free-form note (e.g. "codex→claude"). */
  note?: string;
}

export interface UsageSummary {
  available: boolean;
  events: number;
  totalChars: number;
  totalTokensProxy: number;
  byType: Record<string, number>;
  byAgent: Record<string, number>;
  handoffCount: number;
  /** tokensProxy / (maxHandoffChars/4) when a profile budget is provided. */
  budgetRatio: number | null;
  proxyNote: string;
}

const CHARS_PER_TOKEN = 4;

export function charsToTokenProxy(chars: number): number {
  return Math.ceil(Math.max(0, chars) / CHARS_PER_TOKEN);
}

export class UsageLedger {
  private readonly file: string;
  constructor(private readonly repoRoot: string) {
    this.file = path.join(repoRoot, SESSION_DIR, SESSION_FILES.usage);
  }

  /** Append one event. Best-effort: never throws into the caller's hot path. */
  record(type: UsageEventType, agent: AgentId | "none", chars: number, note?: string): void {
    const event: UsageEvent = {
      ts: new Date().toISOString(),
      type,
      agent,
      chars: Math.max(0, Math.floor(chars)),
      tokensProxy: charsToTokenProxy(chars),
      ...(note ? { note } : {}),
    };
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.appendFileSync(this.file, JSON.stringify(event) + "\n", "utf8");
    } catch {
      /* usage accounting is advisory; ignore write failures */
    }
  }

  /** Read all well-formed events; tolerant of malformed lines. */
  read(): UsageEvent[] {
    let raw: string;
    try { raw = fs.readFileSync(this.file, "utf8"); } catch { return []; }
    const out: UsageEvent[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      try {
        const e = JSON.parse(t) as UsageEvent;
        if (e && typeof e.chars === "number" && typeof e.tokensProxy === "number") out.push(e);
      } catch { /* skip malformed line */ }
    }
    return out;
  }

  /** Aggregate the ledger. `maxHandoffChars` enables a budget ratio. */
  summarize(maxHandoffChars?: number): UsageSummary {
    const events = this.read();
    const byType: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    let totalChars = 0;
    let totalTokensProxy = 0;
    let handoffCount = 0;
    for (const e of events) {
      totalChars += e.chars;
      totalTokensProxy += e.tokensProxy;
      byType[e.type] = (byType[e.type] ?? 0) + e.tokensProxy;
      byAgent[e.agent] = (byAgent[e.agent] ?? 0) + e.tokensProxy;
      if (e.type === "handoff") handoffCount++;
    }
    const budgetRatio = maxHandoffChars && maxHandoffChars > 0
      ? Number((totalTokensProxy / charsToTokenProxy(maxHandoffChars)).toFixed(3))
      : null;
    return {
      available: events.length > 0,
      events: events.length,
      totalChars,
      totalTokensProxy,
      byType,
      byAgent,
      handoffCount,
      budgetRatio,
      proxyNote: "token proxy = ceil(chars/4); not a real tokenizer; local only, never transmitted",
    };
  }
}
