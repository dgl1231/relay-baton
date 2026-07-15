import type { AgentEvent } from "@relay-baton/shared";
import type { AgentAdapter } from "@relay-baton/core";
import { ui, color } from "./ui";

/**
 * Shared --pretty wiring for every agent-launching command. Returns whether
 * the structured stream should be requested (`structuredStream` for
 * buildCommand) plus the runAgent IO callbacks: parsed lines render as
 * events, unparsed lines and stderr stay raw.
 */
export function agentStreamIO(adapter: AgentAdapter, pretty?: boolean): {
  structured: boolean;
  io: {
    onStdout: (line: string) => void;
    onStderr: (line: string) => void;
    parseEvent?: (line: string) => AgentEvent[] | null;
    onEvent?: (event: AgentEvent) => void;
  };
} {
  const structured = !!pretty && typeof adapter.parseEvent === "function";
  if (pretty && !structured) ui.warn(`--pretty is not supported for ${adapter.id} yet — showing raw output.`);
  return {
    structured,
    io: {
      onStdout: (l: string) => process.stdout.write(l + "\n"),
      onStderr: (l: string) => process.stderr.write(l + "\n"),
      parseEvent: structured ? (l: string) => adapter.parseEvent!(l) : undefined,
      onEvent: structured ? renderAgentEvent : undefined,
    },
  };
}

/**
 * Display-only renderer for the structured agent event stream (`run --pretty`).
 * Assistant text prints as-is; tool calls and reasoning become short dim
 * lines; the closing usage event becomes a one-line receipt. No logic beyond
 * formatting — the raw stream is already in .ai-session/commands.log.
 */
export function renderAgentEvent(ev: AgentEvent): void {
  switch (ev.type) {
    case "assistant_text":
      if (ev.text?.trim()) process.stdout.write(ev.text.trimEnd() + "\n");
      break;
    case "reasoning": {
      const first = firstLine(ev.text);
      if (first) console.log(color.dim(`  · thinking: ${first}`));
      break;
    }
    case "tool_use":
      ui.step(`${ev.tool ?? "tool"}${ev.detail ? color.dim(": " + ev.detail) : ""}`);
      break;
    case "system":
      if (ev.text) ui.info(ev.text);
      break;
    case "usage": {
      const u = ev.usage ?? {};
      const parts: string[] = [];
      if (u.inputTokens != null) parts.push(`in ${u.inputTokens.toLocaleString()} tok`);
      if (u.outputTokens != null) parts.push(`out ${u.outputTokens.toLocaleString()} tok`);
      if (u.costUsd != null) parts.push(`$${u.costUsd.toFixed(4)}`);
      if (u.durationMs != null) parts.push(`${(u.durationMs / 1000).toFixed(1)}s`);
      ui.ok(`agent turn done${parts.length ? color.dim(" — " + parts.join(" · ")) : ""}`);
      break;
    }
    case "error":
      ui.fail(ev.text ?? "agent error");
      break;
    default:
      if (ev.text) console.log(ev.text);
  }
}

function firstLine(text: string | undefined): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  const line = t.split("\n", 1)[0];
  return line.length > 120 ? line.slice(0, 117) + "..." : line;
}
