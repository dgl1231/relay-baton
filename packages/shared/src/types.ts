export type AgentId = "codex" | "claude" | "opencode" | "gemini" | "aider";

export type DietProfileName = "off" | "lite" | "balanced" | "caveman" | "ultra";

export type SessionStatus =
  | "initialized"
  | "running"
  | "fallback_detected"
  | "handoff_ready"
  | "running_fallback"
  // v0.5 plan-execute mode
  | "planning"
  | "plan_ready"
  | "executing"
  // v0.5 context compression mode
  | "compressing"
  | "completed"
  | "failed";

export type WorkflowMode = "fallback" | "plan-execute";

export interface DietProfile {
  maxHandoffChars: number;
  maxDiffChars: number;
  maxRepoMapChars: number;
  maxLogTailChars: number;
  maxStateChars: number;
  maxErrorChars: number;
  /** v0.5 plan-execute: max chars for plan.md. Defaults to maxHandoffChars when absent. */
  maxPlanChars?: number;
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
  /**
   * v1.0 frozen-contract marker. Absent = legacy (treated as version 1).
   * See CONFIG_VERSION in constants.
   */
  configVersion?: number;
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
  // v0.5 plan-execute mode (optional; defaults applied when absent).
  planExecute?: {
    defaultPlanner: AgentId;
    defaultExecutor: AgentId;
    maxPlanChars?: number;
  };
  // v0.5 context compression mode (optional; defaults applied when absent).
  contextCompression?: {
    enabled: boolean;
    /** Auto-compress inside `run` when the threshold is crossed. */
    auto: boolean;
    /** Fraction (0..1) of the profile budget that triggers compression. */
    threshold: number;
    /** Keep the pre-compression commands.log as commands.log.full.<timestamp>. */
    rotateRawArtifacts: boolean;
    /**
     * v0.9: adaptive per-agent thresholds. When the active agent has an entry,
     * it overrides the global `threshold`. Agents with larger context windows
     * can run hotter (higher threshold) before compaction kicks in.
     */
    perAgent?: Partial<Record<AgentId, number>>;
  };
}

export interface SessionMeta {
  /**
   * v1.0 frozen-contract marker. Absent = legacy (treated as version 1).
   * See SESSION_SCHEMA_VERSION in constants.
   */
  schemaVersion?: number;
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
  // v0.4 observability — all optional for backward compatibility with
  // sessions created on older versions of the CLI.
  /** ISO timestamp when the most recent `run` / `handoff` command kicked off. */
  startedAt?: string;
  /** ISO timestamp when the session transitioned to `completed` or `failed`. */
  endedAt?: string;
  /** endedAt - startedAt, in milliseconds. Cleared on a new run/handoff. */
  durationMs?: number;
  /** Total number of handoff documents successfully written in this session. */
  handoffCount?: number;
  // v0.5 plan-execute mode — all optional, backward compatible.
  /** Which workflow produced this session. Absent = legacy fallback flow. */
  workflowMode?: WorkflowMode;
  /** Agent that authored .ai-session/plan.md. */
  planAuthor?: AgentId | null;
  /** Agent that executes from the plan. */
  executor?: AgentId | null;
  /** ISO timestamp when plan.md passed its quality gate. */
  planFinalizedAt?: string;
  /** ISO timestamp when the execute phase started. */
  executeStartedAt?: string;
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

// v0.7 — conversation event schema (DRAFT).
// Append-only event log groundwork for the future Agent Room / Conversation
// Mode (see docs/AGENT_ROOM.md). v0.7 only defines the schema and lets
// `review`/`diagnose` persist events; no chat/room command ships yet.
export type ConversationRole = "user" | "claude" | "codex" | "relay-baton";

export type ConversationEventKind =
  | "message"
  | "command"
  | "prompt_preview"
  | "agent_run"
  | "plan"
  | "execute"
  | "review"
  | "diagnose"
  | "handoff"
  | "status"
  | "budget";

export interface ConversationEvent {
  /** Stable id, e.g. "evt_<uuid>". */
  id: string;
  /** ISO timestamp. */
  ts: string;
  /** Owning session (SessionMeta.id) when known. */
  sessionId?: string;
  role: ConversationRole;
  kind: ConversationEventKind;
  /** Token-diet-friendly summary. NEVER a full diff/log — reference instead. */
  text: string;
  /** Pointers to .ai-session artifacts (relative names), not inlined blobs. */
  refs?: Record<string, string>;
  /** Kind-specific, all optional. */
  meta?: {
    agent?: AgentId;
    diet?: DietProfileName;
    exitCode?: number;
    confirmed?: boolean;
    stepRefs?: string[];
    [k: string]: unknown;
  };
}

export interface BatonProject {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  defaultDiet?: DietProfileName;
  primaryAgent?: AgentId;
  fallbackAgent?: AgentId;
  /**
   * v0.8: project-level fallback-pattern overlay. When set and non-empty,
   * these are appended to the global config.fallbackPatterns (deduped,
   * case-insensitive) for runs scoped to this project.
   */
  fallbackPatterns?: string[];
}

export interface ProjectRegistryData {
  activeProjectId: string | null;
  projects: BatonProject[];
}
