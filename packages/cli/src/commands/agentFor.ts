import {
  CodexAdapter,
  ClaudeCodeAdapter,
  OpenCodeAdapter,
  GeminiAdapter,
  AiderAdapter,
} from "@relay-baton/core";
import type { AgentAdapter } from "@relay-baton/core";
import type { AgentId, RelayBatonConfig } from "@relay-baton/shared";

/**
 * Resolve an AgentAdapter for a given agent id, honoring config.agents overrides.
 * codex and claude are first-class; opencode / gemini / aider are v0.8 scaffolds.
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
    default:
      console.error(`[relay-baton] unsupported agent: ${id} (supported: codex, claude, opencode, gemini, aider)`);
      process.exit(2);
  }
}
