import { CodexAdapter, ClaudeCodeAdapter } from "@relay-baton/core";
import type { AgentAdapter } from "@relay-baton/core";
import type { AgentId, RelayBatonConfig } from "@relay-baton/shared";

/**
 * Resolve an AgentAdapter for a given agent id, honoring config.agents overrides.
 * MVP supports codex and claude; other ids error clearly.
 */
export function adapterFor(id: AgentId, config: RelayBatonConfig): AgentAdapter {
  switch (id) {
    case "codex":
      return new CodexAdapter(config.agents.codex);
    case "claude":
      return new ClaudeCodeAdapter(config.agents.claude);
    default:
      console.error(`[relay-baton] unsupported agent: ${id} (MVP supports: codex, claude)`);
      process.exit(2);
  }
}
