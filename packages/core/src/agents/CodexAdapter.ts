import { safeSpawnSync } from "./safeSpawn";
import type { AgentCommand, AgentRunInput, AgentConfig, AgentEvent } from "@relay-baton/shared";
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
    // `codex exec --json` emits one JSON event per line (thread/turn/item).
    const args = input.structuredStream
      ? [...this.cfg.args, "--json", input.task]
      : [...this.cfg.args, input.task];
    return { command: this.cfg.command, args, cwd: input.repoRoot };
  }

  parseEvent(line: string): AgentEvent[] | null {
    const t = line.trim();
    if (!t.startsWith("{")) return null;
    let j: any;
    try { j = JSON.parse(t); } catch { return null; }
    if (typeof j.type !== "string") return null;
    switch (j.type) {
      case "thread.started":
        return [{ type: "system", text: j.thread_id ? `thread ${j.thread_id}` : "thread started" }];
      case "turn.started":
      case "item.started":
      case "item.updated":
        // only completed items are rendered, so nothing shows twice
        return [];
      case "item.completed":
        return codexItemEvents(j.item);
      case "turn.completed":
        return [{
          type: "usage",
          usage: {
            inputTokens: j.usage?.input_tokens,
            outputTokens: j.usage?.output_tokens,
          },
        }];
      case "turn.failed":
        return [{ type: "error", text: unwrapCodexError(j.error?.message) ?? "turn failed" }];
      case "error":
        return [{ type: "error", text: unwrapCodexError(j.message) ?? "agent error" }];
      default:
        return null;
    }
  }
}

/**
 * codex sometimes nests the upstream API error as a JSON string inside
 * `message` — unwrap `error.message` when it parses, otherwise return as-is.
 */
function unwrapCodexError(message: unknown): string | undefined {
  if (typeof message !== "string" || !message) return undefined;
  const t = message.trim();
  if (t.startsWith("{")) {
    try {
      const inner = JSON.parse(t);
      const msg = inner?.error?.message ?? inner?.message;
      if (typeof msg === "string" && msg) return msg;
    } catch { /* not JSON — fall through */ }
  }
  return message;
}

function codexItemEvents(item: any): AgentEvent[] {
  if (!item || typeof item !== "object") return [];
  // newer codex versions use item.item_type; some emit item.type
  const kind = item.item_type ?? item.type;
  switch (kind) {
    case "agent_message":
      return typeof item.text === "string" && item.text.trim()
        ? [{ type: "assistant_text", text: item.text }]
        : [];
    case "reasoning":
      return typeof item.text === "string" && item.text.trim()
        ? [{ type: "reasoning", text: item.text }]
        : [];
    case "command_execution": {
      const exit = item.exit_code != null ? ` (exit ${item.exit_code})` : "";
      return [{ type: "tool_use", tool: "exec", detail: `${item.command ?? ""}${exit}`.trim() || undefined }];
    }
    case "file_change": {
      const paths = Array.isArray(item.changes) ? item.changes.map((c: any) => c?.path).filter(Boolean) : [];
      return [{ type: "tool_use", tool: "edit", detail: paths.join(", ") || undefined }];
    }
    case "mcp_tool_call":
      return [{ type: "tool_use", tool: [item.server, item.tool].filter(Boolean).join(".") || "mcp", detail: undefined }];
    case "web_search":
      return [{ type: "tool_use", tool: "web_search", detail: typeof item.query === "string" ? item.query : undefined }];
    default:
      // todo_list and future item types: suppressed rather than dumped raw
      return [];
  }
}
