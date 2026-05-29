import { spawnSync } from "child_process";
import type { AgentCommand, AgentRunInput, AgentConfig } from "@relay-baton/shared";
import type { AgentAdapter } from "./AgentAdapter";

/**
 * Scaffold adapter for the OpenCode CLI (https://opencode.ai).
 * Prompt-based, non-interactive single run. Like Claude, prefers input.prompt
 * and falls back to input.task. No approval-bypass / sandbox-escape flags.
 */
export class OpenCodeAdapter implements AgentAdapter {
  id = "opencode" as const;
  displayName = "OpenCode CLI";
  constructor(private cfg: AgentConfig = { command: "opencode", args: ["run"] }) {}

  async detectAvailable(): Promise<boolean> {
    const r = spawnSync(this.cfg.command, ["--version"], { encoding: "utf8" });
    return r.status === 0 || r.status === null ? r.error == null : false;
  }

  buildCommand(input: AgentRunInput): AgentCommand {
    const prompt = input.prompt ?? input.task;
    const args = [...this.cfg.args, prompt];
    return { command: this.cfg.command, args, cwd: input.repoRoot };
  }
}
