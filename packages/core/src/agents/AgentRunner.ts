import * as fs from "fs";
import type { AuthPolicy, AgentCommand, AgentEvent } from "@relay-baton/shared";
import { FallbackDetector, FallbackHit } from "./FallbackDetector";
import { safeSpawn } from "./safeSpawn";

export interface AgentRunOptions {
  command: AgentCommand;
  logFile: string;
  authPolicy: AuthPolicy;
  allowApiKeyEnv?: boolean;
  fallbackDetector?: FallbackDetector;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
  onFallback?: (hit: FallbackHit) => void;
  /**
   * Adapter's structured-line parser (AgentAdapter.parseEvent). When a stdout
   * line parses (non-null), the resulting events go to onEvent and the raw
   * line is NOT passed to onStdout (it is still written to the log file and
   * still fed to the fallback detector). Lines that return null fall back to
   * onStdout unchanged.
   */
  parseEvent?: (line: string) => AgentEvent[] | null;
  onEvent?: (event: AgentEvent) => void;
}

export interface AgentRunResult {
  exitCode: number | null;
  fallbackReason: string | null;
  removedEnvVars: string[];
  /** Blocked env vars that were allowed through to the child (names only, for audit). */
  passedThroughEnvVars: string[];
  error?: string;
}

export function createAgentEnv(
  baseEnv: NodeJS.ProcessEnv,
  authPolicy: AuthPolicy,
  allowApiKeyEnvOverride?: boolean,
): { env: NodeJS.ProcessEnv; removed: string[]; passedThrough: string[] } {
  const env: NodeJS.ProcessEnv = { ...baseEnv };
  const allow = allowApiKeyEnvOverride === true || authPolicy.allowApiKeyEnv === true;
  const removed: string[] = [];
  const passedThrough: string[] = [];
  for (const name of authPolicy.blockedEnvVars) {
    if (env[name] === undefined) continue;
    if (allow) {
      // Intentionally allowed through — record the NAME only for the audit trail.
      passedThrough.push(name);
    } else {
      delete env[name];
      removed.push(name);
    }
  }
  return { env, removed, passedThrough };
}

export async function runAgent(opts: AgentRunOptions): Promise<AgentRunResult> {
  const { command, logFile, authPolicy, allowApiKeyEnv, fallbackDetector, onStdout, onStderr, onFallback, parseEvent, onEvent } = opts;
  const { env, removed, passedThrough } = createAgentEnv(process.env, authPolicy, allowApiKeyEnv);

  fs.appendFileSync(logFile,
    `\n--- ${new Date().toISOString()} START ${command.command} ${command.args.join(" ")} ---\n` +
    (removed.length ? `[relay-baton] blocked env vars: ${removed.join(", ")}\n` : ""),
    "utf8");

  return new Promise<AgentRunResult>((resolve) => {
    let child;
    try {
      child = safeSpawn(command.command, command.args, {
        cwd: command.cwd,
        env,
        stdio: ["inherit", "pipe", "pipe"],
        shell: false,
      });
    } catch (e: any) {
      const msg = `[relay-baton] failed to spawn ${command.command}: ${e?.message ?? e}`;
      fs.appendFileSync(logFile, msg + "\n", "utf8");
      resolve({ exitCode: null, fallbackReason: null, removedEnvVars: removed, passedThroughEnvVars: passedThrough, error: msg });
      return;
    }

    let fallbackReason: string | null = null;
    let buf = { stdout: "", stderr: "" };
    const handleChunk = (which: "stdout" | "stderr", chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      buf[which] += text;
      let idx;
      while ((idx = buf[which].indexOf("\n")) >= 0) {
        const line = buf[which].slice(0, idx);
        buf[which] = buf[which].slice(idx + 1);
        emitLine(which, line);
      }
    };
    const emitLine = (which: "stdout" | "stderr", line: string) => {
      fs.appendFileSync(logFile, `[${which}] ${line}\n`, "utf8");
      if (which === "stdout") {
        const events = parseEvent && onEvent ? parseEvent(line) : null;
        if (events) for (const ev of events) onEvent!(ev);
        else onStdout?.(line);
      } else {
        onStderr?.(line);
      }
      const hit = fallbackDetector?.feed(line);
      if (hit && !fallbackReason) {
        fallbackReason = `Detected pattern "${hit.pattern}" in ${which}: ${line.slice(0, 200)}`;
        onFallback?.(hit);
      }
    };

    child.stdout?.on("data", c => handleChunk("stdout", c));
    child.stderr?.on("data", c => handleChunk("stderr", c));

    child.on("error", (err) => {
      const msg = `[relay-baton] process error: ${err.message}`;
      fs.appendFileSync(logFile, msg + "\n", "utf8");
      const isENOENT = (err as NodeJS.ErrnoException).code === "ENOENT";
      const friendly = isENOENT
        ? `Command not found: "${command.command}". Install it and ensure it is on PATH.`
        : msg;
      resolve({ exitCode: null, fallbackReason, removedEnvVars: removed, passedThroughEnvVars: passedThrough, error: friendly });
    });

    child.on("close", (code) => {
      if (buf.stdout) emitLine("stdout", buf.stdout);
      if (buf.stderr) emitLine("stderr", buf.stderr);
      fs.appendFileSync(logFile, `--- exit ${code} ---\n`, "utf8");
      resolve({ exitCode: code, fallbackReason, removedEnvVars: removed, passedThroughEnvVars: passedThrough });
    });
  });
}
