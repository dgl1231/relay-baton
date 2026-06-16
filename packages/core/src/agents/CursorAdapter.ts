import { safeSpawnSync } from "./safeSpawn";
import type { AgentCommand, AgentRunInput, AgentConfig } from "@relay-baton/shared";
import type { AgentAdapter } from "./AgentAdapter";

/**
 * Adapter for the Cursor CLI agent (https://cursor.com/cli).
 * The headless agent binary is `cursor-agent`; `-p` / `--print` runs a single
 * non-interactive turn. Prompt-based, so it prefers input.prompt and falls back
 * to input.task. No approval-bypass / auto-commit flags in the defaults.
 */
export class CursorAdapter implements AgentAdapter {
  id = "cursor" as const;
  displayName = "Cursor CLI";
  constructor(private cfg: AgentConfig = { command: "cursor-agent", args: ["-p"] }) {}

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
