import type { AgentId } from "@relay-baton/shared";

/**
 * v2.3 — Multi-agent breadth. A single source of truth describing every agent
 * relay-baton can drive: how to install/log in, its default subprocess args, its
 * support tier, and the agent-specific fallback patterns that signal a
 * usage/rate/context/quota stop. CLI/TUI/diagnostics read from here instead of
 * hardcoding the Codex↔Claude pair.
 *
 * Hard constraints unchanged: local subprocess only, no API-key passthrough by
 * default, no approval-bypass flags in any default args.
 */

/**
 * `first-class` — the primary Codex↔Claude relay, exercised end-to-end.
 * `supported` — real adapters with install + login flows + fallback patterns,
 * usable as primary/fallback/planner/executor but less battle-tested.
 */
export type AgentTier = "first-class" | "supported";

export type AgentLoginKind = "subcommand" | "interactive" | "env";

export interface AgentLoginSpec {
  kind: AgentLoginKind;
  /** For kind "subcommand": the args to spawn after the command (e.g. ["login"]). */
  subcommand?: string[];
  /** Human-facing steps shown by `relay-baton login`. */
  instructions: string[];
}

export interface AgentDescriptor {
  id: AgentId;
  displayName: string;
  tier: AgentTier;
  /** Default subprocess command + args (mirrors defaultConfig.agents). */
  command: string;
  defaultArgs: string[];
  installUrl: string;
  login: AgentLoginSpec;
  /**
   * Agent-specific fallback signals merged with the global fallbackPatterns
   * when this agent is the active one. Lowercase substrings.
   */
  fallbackPatterns: string[];
  /**
   * v2.8 advisory routing hints — task keywords this agent is a good first hop
   * for. Deterministic keyword tags only (no model call); used by suggestChain
   * to *propose* a chain order. Explicit --chain/--primary always wins.
   */
  strengths: string[];
  /**
   * v1.7 model selection. `flag` is the agent CLI's model option; `suggested`
   * are known-good ids surfaced in pickers/help — any string is still accepted,
   * so new models work without a relay-baton release.
   */
  model: { flag: string; suggested: string[] };
}

export const AGENT_REGISTRY: Record<AgentId, AgentDescriptor> = {
  codex: {
    id: "codex",
    displayName: "Codex CLI",
    tier: "first-class",
    command: "codex",
    defaultArgs: ["exec", "--sandbox", "workspace-write"],
    installUrl: "https://github.com/openai/codex",
    login: {
      kind: "subcommand",
      subcommand: ["login"],
      instructions: ["`codex login`을 실행합니다. 브라우저 인증을 마치면 자동으로 돌아옵니다."],
    },
    fallbackPatterns: ["usage limit reached", "usage limit", "rate limit", "quota exceeded", "context length exceeded", "context window exceeded", "usage_limit_reached"],
    strengths: ["implement", "refactor", "fix", "bulk-edit", "migrate", "execute"],
    model: { flag: "-m", suggested: ["gpt-6.1-sol", "gpt-6-astra", "gpt-6-luna"] },
  },
  claude: {
    id: "claude",
    displayName: "Claude Code CLI",
    tier: "first-class",
    command: "claude",
    defaultArgs: ["--permission-mode", "acceptEdits", "-p"],
    installUrl: "https://docs.claude.com/en/docs/agents-and-tools/claude-code/setup",
    login: {
      kind: "interactive",
      instructions: [
        "Claude Code 대화형 세션을 엽니다.",
        "1. 프롬프트가 뜨면  /login  을 입력하고 Enter.",
        "2. 안내되는 브라우저 인증을 완료합니다.",
        "3. 끝나면  /exit  또는 Ctrl+C 로 빠져나옵니다.",
      ],
    },
    fallbackPatterns: ["usage limit", "rate_limit_error", "overloaded_error", "credit balance is too low", "prompt is too long", "context low", "context left until auto-compact"],
    strengths: ["plan", "review", "analyze", "design", "architect", "debug", "document"],
    model: { flag: "--model", suggested: ["claude-opus-5-5", "claude-sonnet-5", "claude-fable-5-1", "claude-haiku-4-5"] },
  },
  opencode: {
    id: "opencode",
    displayName: "OpenCode CLI",
    tier: "supported",
    command: "opencode",
    defaultArgs: ["run"],
    installUrl: "https://opencode.ai",
    login: {
      kind: "subcommand",
      subcommand: ["auth", "login"],
      instructions: ["`opencode auth login`을 실행해 제공자(provider)를 선택하고 인증합니다."],
    },
    fallbackPatterns: ["rate limit", "context window", "quota exceeded"],
    strengths: ["implement", "fix", "execute"],
    model: { flag: "--model", suggested: [] },
  },
  gemini: {
    id: "gemini",
    displayName: "Gemini CLI",
    tier: "supported",
    command: "gemini",
    defaultArgs: ["-p"],
    installUrl: "https://github.com/google-gemini/gemini-cli",
    login: {
      kind: "interactive",
      instructions: [
        "Gemini CLI 대화형 세션을 엽니다.",
        "1. 프롬프트에서  /auth  를 입력해 인증 방식을 고릅니다.",
        "2. 브라우저 인증을 완료한 뒤  /quit  으로 빠져나옵니다.",
      ],
    },
    fallbackPatterns: ["resource_exhausted", "quota exceeded", "rate limit", "429"],
    strengths: ["analyze", "summarize", "research"],
    model: { flag: "-m", suggested: ["gemini-3.8-flash", "gemini-3-pro-preview", "gemini-3.5-flash-lite"] },
  },
  aider: {
    id: "aider",
    displayName: "Aider CLI",
    tier: "supported",
    command: "aider",
    defaultArgs: ["--message"],
    installUrl: "https://aider.chat",
    login: {
      kind: "env",
      instructions: [
        "Aider는 별도 login 명령이 없습니다 — provider API key 환경변수를 사용합니다.",
        "주의: relay-baton은 기본적으로 API key env를 차단합니다.",
        "Aider에 키를 전달하려면 `relay-baton run/handoff ... --allow-api-key-env`가 필요합니다.",
      ],
    },
    fallbackPatterns: ["context window", "tokens exceed", "rate limit"],
    strengths: ["fix", "patch", "edit"],
    model: { flag: "--model", suggested: [] },
  },
  cursor: {
    id: "cursor",
    displayName: "Cursor CLI",
    tier: "supported",
    command: "cursor-agent",
    defaultArgs: ["-p"],
    installUrl: "https://cursor.com/cli",
    login: {
      kind: "subcommand",
      subcommand: ["login"],
      instructions: ["`cursor-agent login`을 실행합니다. 브라우저 인증을 마치면 자동으로 돌아옵니다."],
    },
    fallbackPatterns: ["rate limit", "usage limit", "context length"],
    strengths: ["implement", "refactor", "edit"],
    model: { flag: "--model", suggested: [] },
  },
};

export const ALL_AGENT_IDS = Object.keys(AGENT_REGISTRY) as AgentId[];

export function getAgentDescriptor(id: AgentId): AgentDescriptor {
  return AGENT_REGISTRY[id];
}

export function isAgentId(value: string): value is AgentId {
  return Object.prototype.hasOwnProperty.call(AGENT_REGISTRY, value);
}

/** Agent-specific fallback patterns for the active agent (empty if unknown). */
export function agentFallbackPatterns(id: AgentId): string[] {
  return AGENT_REGISTRY[id]?.fallbackPatterns ?? [];
}

/**
 * Splice the agent's model flag into its subprocess args. Inserted after any
 * leading subcommand (`codex exec`, `opencode run`) and before the first flag,
 * so value-taking flags like `gemini -p <prompt>` keep their operand.
 */
export function withModelArgs(id: AgentId, args: string[], model?: string): string[] {
  const m = model?.trim();
  if (!m) return args;
  let at = 0;
  while (at < args.length && !args[at].startsWith("-")) at++;
  return [...args.slice(0, at), AGENT_REGISTRY[id].model.flag, m, ...args.slice(at)];
}

/**
 * Parse one relay-chain entry: `agent` or `agent:model`
 * (e.g. `claude:claude-opus-5-5`). Returns null for an unknown agent.
 */
export function parseChainEntry(entry: string): { agent: AgentId; model?: string } | null {
  const i = entry.indexOf(":");
  const id = (i < 0 ? entry : entry.slice(0, i)).trim();
  const model = i < 0 ? undefined : entry.slice(i + 1).trim() || undefined;
  return isAgentId(id) ? { agent: id, model } : null;
}
