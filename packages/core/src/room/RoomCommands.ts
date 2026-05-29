import type { AgentId } from "@relay-baton/shared";

/**
 * Slash-command vocabulary for the Agent Room (v0.8 first cut).
 * Parsing is deterministic and model-free; this module owns ONLY the grammar,
 * not execution. The REPL/engine decides what to do with a parsed command.
 */
export type RoomCommandName =
  | "agent"
  | "plan"
  | "execute"
  | "review"
  | "handoff"
  | "budget"
  | "status"
  | "help"
  | "exit";

export interface ParsedCommand {
  name: RoomCommandName;
  /** Raw argument string after the command token (trimmed). */
  args: string;
}

export const ROOM_COMMANDS: { name: RoomCommandName; usage: string; help: string }[] = [
  { name: "agent", usage: "/agent <claude|codex>", help: "switch the agent you are addressing" },
  { name: "plan", usage: "/plan <task>", help: "preview a plan run (planner agent)" },
  { name: "execute", usage: "/execute", help: "preview an execute run (executor agent)" },
  { name: "review", usage: "/review", help: "deterministic diff-vs-plan review (no model call)" },
  { name: "handoff", usage: "/handoff", help: "preview a handoff to the next agent" },
  { name: "budget", usage: "/budget", help: "show context-budget usage" },
  { name: "status", usage: "/status", help: "show current session status" },
  { name: "help", usage: "/help", help: "list room commands" },
  { name: "exit", usage: "/exit", help: "leave the room" },
];

const NAMES = new Set(ROOM_COMMANDS.map(c => c.name));

/**
 * Parse a line as a slash command. Returns null for plain chat messages
 * (anything not starting with `/`). Unknown `/foo` returns null too so the
 * engine can report it as an error rather than silently dropping it.
 */
export function parseSlash(line: string): ParsedCommand | null {
  const t = line.trim();
  if (!t.startsWith("/")) return null;
  const m = /^\/([A-Za-z]+)\s*(.*)$/.exec(t);
  if (!m) return null;
  const name = m[1].toLowerCase();
  if (!NAMES.has(name as RoomCommandName)) return null;
  return { name: name as RoomCommandName, args: m[2].trim() };
}

/** Validate an `/agent <id>` argument against the room-addressable agents. */
export function parseAgentArg(args: string): AgentId | null {
  const a = args.trim().toLowerCase();
  if (a === "claude" || a === "codex") return a;
  return null;
}

export function roomHelpText(): string {
  return ROOM_COMMANDS.map(c => `  ${c.usage.padEnd(22)} ${c.help}`).join("\n");
}
