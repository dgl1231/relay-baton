import { spawn } from "child_process";
import * as fs from "fs";
import type { AuthPolicy, AgentCommand } from "@relay-baton/shared";
import { FallbackDetector, FallbackHit } from "./FallbackDetector";

export interface AgentRunOptions {
  command: AgentCommand;
  logFile: string;
  authPolicy: AuthPolicy;
  allowApiKeyEnv?: boolean;
  fallbackDetector?: FallbackDetector;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
  onFallback?: (hit: FallbackHit) => void;
}

export interface AgentRunResult {
  exitCode: number | null;
  fallbackReason: string | null;
  removedEnvVars: string[];
  error?: string;
}

export function createAgentEnv(
  baseEnv: NodeJS.ProcessEnv,
  authPolicy: AuthPolicy,
  allowApiKeyEnvOverride?: boolean,
): { env: NodeJS.ProcessEnv; removed: string[] } {
  const env: NodeJS.ProcessEnv = { ...baseEnv };
  const allow = allowApiKeyEnvOverride === true || authPolicy.allowApiKeyEnv === true;
  const removed: string[] = [];
  if (!allow) {
    for (const name of authPolicy.blockedEnvVars) {
      if (env[name] !== undefined) {
        delete env[name];
        removed.push(name);
      }
    }
  }
  return { env, removed };
}

export async function runAgent(opts: AgentRunOptions): Promise<AgentRunResult> {
  const { command, logFile, authPolicy, allowApiKeyEnv, fallbackDetector, onStdout, onStderr, onFallback } = opts;
  const { env, removed } = createAgentEnv(process.env, authPolicy, allowApiKeyEnv);

  fs.appendFileSync(logFile,
    `\n--- ${new Date().toISOString()} START ${command.command} ${command.args.join(" ")} ---\n` +
    (removed.length ? `[relay-baton] blocked env vars: ${removed.join(", ")}\n` : ""),
    "utf8");

  return new Promise<AgentRunResult>((resolve) => {
    let child;
    try {
      child = spawn(command.command, command.args, {
        cwd: command.cwd,
        env,
        stdio: ["inherit", "pipe", "pipe"],
        shell: false,
      });
    } catch (e: any) {
      const msg = `[relay-baton] failed to spawn ${command.command}: ${e?.message ?? e}`;
      fs.appendFileSync(logFile, msg + "\n", "utf8");
      resolve({ exitCode: null, fallbackReason: null, removedEnvVars: removed, error: msg });
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
      if (which === "stdout") onStdout?.(line);
      else onStderr?.(line);
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
      resolve({ exitCode: null, fallbackReason, removedEnvVars: removed, error: friendly });
    });

    child.on("close", (code) => {
      if (buf.stdout) emitLine("stdout", buf.stdout);
      if (buf.stderr) emitLine("stderr", buf.stderr);
      fs.appendFileSync(logFile, `--- exit ${code} ---\n`, "utf8");
      resolve({ exitCode: code, fallbackReason, removedEnvVars: removed });
    });
  });
}
