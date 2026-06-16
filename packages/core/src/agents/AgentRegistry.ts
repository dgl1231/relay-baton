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
    fallbackPatterns: ["usage limit reached", "rate limit", "quota exceeded", "context length exceeded"],
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
    fallbackPatterns: ["usage limit", "rate_limit_error", "prompt is too long", "context low", "context left until auto-compact"],
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
