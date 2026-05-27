import type {
  AgentCommand,
  AgentEvent,
  AgentId,
  AgentRunInput,
} from "@relay-baton/shared";

export interface AgentAdapter {
  id: AgentId;
  displayName: string;
  detectAvailable(): Promise<boolean>;
  buildCommand(input: AgentRunInput): AgentCommand;
  parseEvent?(line: string): AgentEvent | null;
}
