import { safeSpawnSync } from "./safeSpawn";
import type { AgentCommand, AgentRunInput, AgentConfig, AgentEvent } from "@relay-baton/shared";
import type { AgentAdapter } from "./AgentAdapter";

/**
 * stream-json print mode: `-p --output-format stream-json --verbose` emits one
 * JSON object per line (system init, assistant messages with content blocks,
 * tool results, final result with cost/usage).
 */
const STREAM_ARGS = ["--output-format", "stream-json", "--verbose"];

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
    const args = input.structuredStream
      ? [...this.cfg.args, ...STREAM_ARGS, prompt]
      : [...this.cfg.args, prompt];
    return { command: this.cfg.command, args, cwd: input.repoRoot };
  }

  parseEvent(line: string): AgentEvent[] | null {
    const j = tryParseJson(line);
    if (!j || typeof j.type !== "string") return null;
    switch (j.type) {
      case "system":
        if (j.subtype === "init") {
          const bits = [j.model && `model ${j.model}`, j.session_id && `session ${j.session_id}`].filter(Boolean);
          return [{ type: "system", text: bits.join(" · ") || "session started" }];
        }
        return [];
      case "assistant": {
        const blocks = Array.isArray(j.message?.content) ? j.message.content : [];
        const events: AgentEvent[] = [];
        for (const b of blocks) {
          if (b?.type === "text" && typeof b.text === "string" && b.text.trim()) {
            events.push({ type: "assistant_text", text: b.text });
          } else if (b?.type === "thinking" && typeof b.thinking === "string" && b.thinking.trim()) {
            events.push({ type: "reasoning", text: b.thinking });
          } else if (b?.type === "tool_use") {
            events.push({ type: "tool_use", tool: String(b.name ?? "tool"), detail: summarizeToolInput(b.input) });
          }
        }
        return events;
      }
      case "user":
      case "stream_event":
        // tool results and partial deltas: suppressed (assistant/tool_use
        // events already carry the displayable signal).
        return [];
      case "result": {
        if (j.is_error) {
          return [{ type: "error", text: typeof j.result === "string" ? j.result : (j.subtype ?? "agent error") }];
        }
        return [{
          type: "usage",
          usage: {
            inputTokens: j.usage?.input_tokens,
            outputTokens: j.usage?.output_tokens,
            costUsd: j.total_cost_usd,
            durationMs: j.duration_ms,
          },
        }];
      }
      default:
        return null;
    }
  }
}

function tryParseJson(line: string): any | null {
  const t = line.trim();
  if (!t.startsWith("{")) return null;
  try { return JSON.parse(t); } catch { return null; }
}

/** Short deterministic one-liner for a tool_use input (no summarization). */
export function summarizeToolInput(input: unknown): string | undefined {
  if (input == null || typeof input !== "object") return undefined;
  const i = input as Record<string, unknown>;
  const pick = i.command ?? i.file_path ?? i.path ?? i.pattern ?? i.query ?? i.url;
  if (typeof pick === "string") return pick.length > 160 ? pick.slice(0, 157) + "..." : pick;
  const json = JSON.stringify(i);
  return json.length > 160 ? json.slice(0, 157) + "..." : json;
}
