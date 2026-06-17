import * as fs from "fs";
import { spawnSync } from "child_process";
import type { RelayBatonConfig } from "@relay-baton/shared";
import { SessionFiles } from "../session/SessionFiles";
import { createAgentEnv } from "../agents/AgentRunner";

/**
 * v2.5 — project recipes / hooks. Runs opt-in, config-declared shell commands at
 * lifecycle points (pre-handoff / post-execute). LOCAL ONLY: no daemon, no
 * network access is granted or implied, and the child env is sanitized exactly
 * like an agent's (provider API keys stripped by default). Absent config = no-op.
 *
 * Hooks are the user's own configured commands (like git hooks / npm scripts),
 * so they run through the platform shell; output is mirrored and appended to
 * commands.log. Determinism: commands run in declared order, one at a time.
 */

export type HookPhase = "preHandoff" | "postExecute";

export interface HookResult {
  command: string;
  exitCode: number | null;
  ok: boolean;
  error?: string;
}

export interface HookRunOptions {
  allowApiKeyEnv?: boolean;
  /** Mirror hook stdout/stderr to these sinks (CLI passes process streams). */
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
}

export class HookRunner {
  private files: SessionFiles;
  constructor(private readonly repoRoot: string, private readonly config: RelayBatonConfig) {
    this.files = new SessionFiles(repoRoot);
  }

  /** Commands configured for a phase (empty when none). */
  commandsFor(phase: HookPhase): string[] {
    const list = this.config.hooks?.[phase];
    return Array.isArray(list) ? list.filter(c => typeof c === "string" && c.trim().length > 0) : [];
  }

  /**
   * Run all commands for a phase in order. Returns one result per command. A
   * non-zero exit does NOT throw — the caller decides whether to continue.
   */
  run(phase: HookPhase, opts: HookRunOptions = {}): HookResult[] {
    const commands = this.commandsFor(phase);
    if (commands.length === 0) return [];

    const { env } = createAgentEnv(process.env, this.config.authPolicy, opts.allowApiKeyEnv);
    const results: HookResult[] = [];
    for (const command of commands) {
      this.appendLog(`\n$ [hook:${phase}] ${command}\n`);
      try {
        const r = spawnSync(command, {
          cwd: this.repoRoot,
          env,
          shell: true,
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024,
        });
        const stdout = r.stdout ?? "";
        const stderr = r.stderr ?? "";
        if (stdout) { opts.onStdout?.(stdout.replace(/\n$/, "")); this.appendLog(stdout); }
        if (stderr) { opts.onStderr?.(stderr.replace(/\n$/, "")); this.appendLog(stderr); }
        const exitCode = r.status;
        results.push({
          command,
          exitCode,
          ok: exitCode === 0,
          error: r.error ? r.error.message : undefined,
        });
        if (exitCode !== 0) break; // stop the chain on first failure
      } catch (e: any) {
        results.push({ command, exitCode: null, ok: false, error: e?.message ?? String(e) });
        break;
      }
    }
    return results;
  }

  private appendLog(text: string): void {
    try {
      fs.mkdirSync(this.files.dir, { recursive: true });
      fs.appendFileSync(this.files.p("commandsLog"), text, "utf8");
    } catch { /* logging is advisory */ }
  }
}
