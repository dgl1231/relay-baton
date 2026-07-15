import type {
  AgentCommand,
  AgentEvent,
  AgentId,
  AgentRunInput,
} from "@relay-baton/shared";

export interface AgentAdapter {
  id: AgentId;
  displayName: string;
  detectAvailable(): Promise<boolean>;
  buildCommand(input: AgentRunInput): AgentCommand;
  /**
   * Deterministically parse one stdout line of the agent CLI's structured
   * (JSONL) output into displayable events. Contract:
   * - `null`  — not a structured line; caller should fall back to raw output.
   * - `[]`    — recognized but intentionally suppressed (dedup/noise).
   * - events  — render these instead of the raw line.
   * Only meaningful when the command was built with `structuredStream: true`.
   */
  parseEvent?(line: string): AgentEvent[] | null;
}
