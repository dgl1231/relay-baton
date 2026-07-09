import type { AgentId } from "@relay-baton/shared";
import { AGENT_REGISTRY } from "./AgentRegistry";

/**
 * v2.8 — Deterministic routing hints (advisory only). Given a task string,
 * propose an ordering of the agents in the current relay chain by matching the
 * task's words against each agent's registry `strengths` tags. Pure keyword
 * matching, no model call, no auto-pick: callers only *display* the suggestion;
 * explicit --chain/--primary (and the resolved chain itself) always win.
 */

export interface RoutingSuggestion {
  /** The input chain reordered by descending strength match (stable on ties). */
  chain: AgentId[];
  /** Which strength tags matched the task, per agent (only agents with hits). */
  matched: Partial<Record<AgentId, string[]>>;
  /** True when the suggestion differs from the input chain order. */
  differs: boolean;
}

/** Lowercase word list from a task string (split on non-alphanumerics). */
function taskWords(task: string): Set<string> {
  return new Set(task.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean));
}

/**
 * Reorder `chain` by how many of each agent's strength tags appear in the task.
 * Stable: agents with equal scores keep their input order, so an unmatched task
 * returns the chain unchanged (differs: false).
 */
export function suggestChain(task: string, chain: AgentId[]): RoutingSuggestion {
  const words = taskWords(task);
  const matched: Partial<Record<AgentId, string[]>> = {};
  const score = new Map<AgentId, number>();
  for (const id of chain) {
    const hits = (AGENT_REGISTRY[id]?.strengths ?? []).filter(s => words.has(s));
    if (hits.length > 0) matched[id] = hits;
    score.set(id, hits.length);
  }
  const suggested = [...chain].sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0));
  const differs = suggested.some((id, i) => id !== chain[i]);
  return { chain: suggested, matched, differs };
}
