export type AgentId = "codex" | "claude" | "opencode" | "gemini" | "aider";

export type DietProfileName = "off" | "lite" | "balanced" | "caveman" | "ultra";

export type SessionStatus =
  | "initialized"
  | "running"
  | "fallback_detected"
  | "handoff_ready"
  | "running_fallback"
  | "completed"
  | "failed";

export interface DietProfile {
  maxHandoffChars: number;
  maxDiffChars: number;
  maxRepoMapChars: number;
  maxLogTailChars: number;
  maxStateChars: number;
  maxErrorChars: number;
}

export interface AuthPolicy {
  mode: "cli-session" | "api-key";
  allowApiKeyEnv: boolean;
  warnIfApiKeyEnvDetected: boolean;
  blockedEnvVars: string[];
}

export interface AgentConfig {
  command: string;
  args: string[];
}

export interface RelayBatonConfig {
  primaryAgent: AgentId;
  fallbackAgent: AgentId;
  agents: Record<string, AgentConfig>;
  fallbackPatterns: string[];
  commands: { test: string; build: string };
  authPolicy: AuthPolicy;
  tokenDiet: {
    enabled: boolean;
    profile: DietProfileName;
    outputCompression: boolean;
    profiles: Record<string, DietProfile>;
  };
}

export interface SessionMeta {
  id: string;
  createdAt: string;
  updatedAt: string;
  repoRoot: string;
  task: string;
  status: SessionStatus;
  primaryAgent: AgentId;
  fallbackAgent: AgentId;
  activeAgent: AgentId | "none";
  lastAgent: AgentId | "none";
  fallbackReason: string | null;
  lastError: string | null;
  tokenDietProfile: DietProfileName;
}

export interface AgentRunInput {
  task: string;
  repoRoot: string;
  sessionDir: string;
  prompt?: string;
  dietProfile?: DietProfileName;
  allowApiKeyEnv?: boolean;
}

export interface AgentCommand {
  command: string;
  args: string[];
  cwd: string;
}

export interface AgentEvent {
  type: "stdout" | "stderr" | "exit" | "error" | "fallback";
  text?: string;
  code?: number;
  reason?: string;
}

export interface BudgetSnapshot {
  profile: DietProfileName;
  maxHandoffChars: number;
  used: {
    handoff: number;
    repoMap: number;
    fullDiff: number;
    commandsLog: number;
    compactState: number;
  };
  truncated: boolean;
}
