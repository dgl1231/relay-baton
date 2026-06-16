import {
  CodexAdapter,
  ClaudeCodeAdapter,
  OpenCodeAdapter,
  GeminiAdapter,
  AiderAdapter,
  CursorAdapter,
  ALL_AGENT_IDS,
} from "@relay-baton/core";
import type { AgentAdapter } from "@relay-baton/core";
import type { AgentId, RelayBatonConfig } from "@relay-baton/shared";

/**
 * Resolve an AgentAdapter for a given agent id, honoring config.agents overrides.
 * codex / claude are first-class; opencode / gemini / aider / cursor are v2.3
 * supported adapters (see AgentRegistry for tiers).
 */
export function adapterFor(id: AgentId, config: RelayBatonConfig): AgentAdapter {
  switch (id) {
    case "codex":
      return new CodexAdapter(config.agents.codex);
    case "claude":
      return new ClaudeCodeAdapter(config.agents.claude);
    case "opencode":
      return new OpenCodeAdapter(config.agents.opencode);
    case "gemini":
      return new GeminiAdapter(config.agents.gemini);
    case "aider":
      return new AiderAdapter(config.agents.aider);
    case "cursor":
      return new CursorAdapter(config.agents.cursor);
    default:
      console.error(`[relay-baton] unsupported agent: ${id} (supported: ${ALL_AGENT_IDS.join(", ")})`);
      process.exit(2);
  }
}
