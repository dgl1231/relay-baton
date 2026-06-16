import { safeSpawnSync } from "./safeSpawn";
import type { AgentCommand, AgentRunInput, AgentConfig } from "@relay-baton/shared";
import type { AgentAdapter } from "./AgentAdapter";

export class ClaudeCodeAdapter implements AgentAdapter {
  id = "claude" as const;
  displayName = "Claude Code CLI";
  constructor(private cfg: AgentConfig = { command: "claude", args: ["--permission-mode", "acceptEdits", "-p"] }) {}

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
