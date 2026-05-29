import type { AgentId } from "@relay-baton/shared";
import { ConversationLog } from "../conversation/ConversationLog";
import { parseSlash, parseAgentArg, parseMaxSteps, roomHelpText, RoomCommandName } from "./RoomCommands";

/**
 * What the REPL should do in response to a line. The engine is pure and
 * model-free: it parses, updates room state, persists conversation events,
 * and returns an action descriptor. It NEVER spawns an agent itself — the CLI
 * layer executes run-type actions, confirmation-first, with a prompt preview.
 */
export type RoomAction =
  | { kind: "noop" }
  | { kind: "exit" }
  | { kind: "help"; text: string }
  | { kind: "chat"; agent: AgentId; text: string }
  | { kind: "switch-agent"; agent: AgentId }
  | { kind: "error"; message: string }
  /** A run the CLI should preview + confirm before executing. */
  | { kind: "run"; command: RunCommand; args: string; agent: AgentId; requiresConfirmation: boolean; maxSteps?: number };

export type RunCommand =
  | "plan"
  | "replan"
  | "execute"
  | "continue"
  | "review"
  | "diagnose"
  | "handoff"
  | "budget"
  | "status"
  | "replay";

/** Read-only / no-model commands skip the confirmation gate. */
const NO_CONFIRM: ReadonlySet<RunCommand> = new Set(["review", "diagnose", "budget", "status", "replay"]);

export class RoomEngine {
  private log: ConversationLog;
  private agent: AgentId;

  constructor(
    private repoRoot: string,
    private sessionId?: string,
    initialAgent: AgentId = "claude",
  ) {
    this.log = new ConversationLog(repoRoot);
    this.agent = initialAgent;
  }

  get currentAgent(): AgentId {
    return this.agent;
  }

  /** Process one input line and return the action the REPL should take. */
  handle(line: string): RoomAction {
    const cmd = parseSlash(line);

    if (!cmd) {
      const t = line.trim();
      if (t.startsWith("/")) {
        return { kind: "error", message: `unknown command: ${t.split(/\s+/)[0]} (try /help)` };
      }
      if (!t) return { kind: "noop" };
      // Plain chat message addressed to the current agent.
      this.log.append({
        role: "user",
        kind: "message",
        text: t,
        sessionId: this.sessionId,
        meta: { agent: this.agent },
      });
      return { kind: "chat", agent: this.agent, text: t };
    }

    switch (cmd.name as RoomCommandName) {
      case "exit":
        return { kind: "exit" };
      case "help":
        return { kind: "help", text: roomHelpText() };
      case "agent": {
        const next = parseAgentArg(cmd.args);
        if (!next) return { kind: "error", message: "usage: /agent <claude|codex>" };
        this.agent = next;
        this.log.append({
          role: "relay-baton",
          kind: "status",
          text: `addressing agent: ${next}`,
          sessionId: this.sessionId,
          meta: { agent: next },
        });
        return { kind: "switch-agent", agent: next };
      }
      case "plan":
      case "replan":
      case "execute":
      case "continue":
      case "review":
      case "diagnose":
      case "handoff":
      case "budget":
      case "status":
      case "replay": {
        const command = cmd.name as RunCommand;
        if ((command === "plan" || command === "replan") && !cmd.args) {
          return { kind: "error", message: `usage: /${command} <task>` };
        }
        const maxSteps = command === "continue" ? parseMaxSteps(cmd.args) : undefined;
        return {
          kind: "run",
          command,
          args: cmd.args,
          agent: this.agent,
          requiresConfirmation: !NO_CONFIRM.has(command),
          maxSteps,
        };
      }
      default:
        return { kind: "error", message: `unhandled command: ${cmd.name}` };
    }
  }
}
