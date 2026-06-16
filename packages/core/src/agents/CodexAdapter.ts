import { safeSpawnSync } from "./safeSpawn";
import type { AgentCommand, AgentRunInput, AgentConfig } from "@relay-baton/shared";
import type { AgentAdapter } from "./AgentAdapter";

export class CodexAdapter implements AgentAdapter {
  id = "codex" as const;
  displayName = "Codex CLI";
  constructor(private cfg: AgentConfig = { command: "codex", args: ["exec", "--sandbox", "workspace-write"] }) {}

  async detectAvailable(): Promise<boolean> {
    const r = safeSpawnSync(this.cfg.command, ["--version"], { encoding: "utf8" });
    return r.status === 0 || r.status === null ? r.error == null : false;
  }

  buildCommand(input: AgentRunInput): AgentCommand {
    const args = [...this.cfg.args, input.task];
    return { command: this.cfg.command, args, cwd: input.repoRoot };
  }
}
