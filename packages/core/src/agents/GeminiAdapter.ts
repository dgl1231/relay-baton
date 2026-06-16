import { safeSpawnSync } from "./safeSpawn";
import type { AgentCommand, AgentRunInput, AgentConfig } from "@relay-baton/shared";
import type { AgentAdapter } from "./AgentAdapter";

/**
 * Scaffold adapter for the Gemini CLI (https://github.com/google-gemini/gemini-cli).
 * Prompt-based, non-interactive (`gemini -p "<prompt>"`). Prefers input.prompt,
 * falls back to input.task. No approval-bypass flags.
 */
export class GeminiAdapter implements AgentAdapter {
  id = "gemini" as const;
  displayName = "Gemini CLI";
  constructor(private cfg: AgentConfig = { command: "gemini", args: ["-p"] }) {}

  async detectAvailable(): Promise<boolean> {
    const r = safeSpawnSync(this.cfg.command, ["--version"], { encoding: "utf8" });
    return r.status === 0 || r.status === null ? r.error == null : false;
  }

  buildCommand(input: AgentRunInput): AgentCommand {
    const prompt = input.prompt ?? input.task;
    const args = [...this.cfg.args, prompt];
    return { command: this.cfg.command, args, cwd: input.repoRoot };
  }
}
