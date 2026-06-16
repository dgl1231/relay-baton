import { safeSpawnSync } from "./safeSpawn";
import type { AgentCommand, AgentRunInput, AgentConfig } from "@relay-baton/shared";
import type { AgentAdapter } from "./AgentAdapter";

/**
 * Scaffold adapter for the Aider CLI (https://aider.chat).
 * Single-message non-interactive run (`aider --message "<task>"`). Aider is
 * task/message oriented, so it prefers input.task (falls back to input.prompt).
 * No `--yes`/auto-commit flags in the defaults — relay-baton never auto-commits.
 */
export class AiderAdapter implements AgentAdapter {
  id = "aider" as const;
  displayName = "Aider CLI";
  constructor(private cfg: AgentConfig = { command: "aider", args: ["--message"] }) {}

  async detectAvailable(): Promise<boolean> {
    const r = safeSpawnSync(this.cfg.command, ["--version"], { encoding: "utf8" });
    return r.status === 0 || r.status === null ? r.error == null : false;
  }

  buildCommand(input: AgentRunInput): AgentCommand {
    const message = input.task ?? input.prompt ?? "";
    const args = [...this.cfg.args, message];
    return { command: this.cfg.command, args, cwd: input.repoRoot };
  }
}
