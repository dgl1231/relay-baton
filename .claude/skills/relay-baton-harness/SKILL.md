---
name: relay-baton-harness
description: Use when designing or implementing relay-baton, a local Codex-to-Claude Code handoff harness with token diet, compact state, fallback detection, and CLI/TUI architecture.
---

# relay-baton Harness Skill

Use this skill when working on `relay-baton`.

relay-baton is a local handoff harness for coding agents.

Primary goal:
- Start work with Codex CLI.
- Detect usage/rate/token/context/quota failures.
- Generate compact handoff files.
- Manage multiple repositories through a local project registry.
- Continue work with Claude Code.
- Reduce token waste through compact state, diff summaries, log tails, repo maps, and file references.

This project is not:
- a real-time agent chat platform
- an LLM API client
- an auto PR bot
- an auto commit/push tool
- a tmux manager
- a full IDE extension in MVP

## Core Architecture

Use a TypeScript / Node.js / pnpm monorepo.

Packages:
- `packages/shared`
- `packages/core`
- `packages/cli`
- `packages/tui`

Core must be UI-independent.

Core modules:
- ConfigLoader, SessionManager, Logger
- GitService, RepoMapGenerator, FallbackDetector
- AgentAdapter, CodexAdapter, ClaudeCodeAdapter, AgentRunner
- BudgetManager, ContextSelector
- DiffCompactor, LogCompactor, StateCompactor
- HandoffGenerator, HandoffCompactor, ReferenceResolver
- HandoffQualityGate, TokenDietQualityGate
- PromptBuilder, BatonWorkflow
- ProjectRegistry, ProjectManager, ProjectResolver

## Agent CLI Defaults

- Codex: `codex exec --sandbox workspace-write "<task>"`. Do not use `--full-auto` (deprecated) or `--ask-for-approval` (unsupported in current Codex).
- Claude Code: `claude --permission-mode acceptEdits -p "<prompt>"`. Do not use `bypassPermissions`. Login (`/login`) is separate from `claude --version`.
- Config `agents.<id>.args` overrides the default args.

## Fallback Patterns

Use specific phrases, not bare keywords. Avoid false positives from grep results and documentation lines that merely describe the patterns.

## Required CLI Commands

- `relay-baton init`
- `relay-baton doctor`
- `relay-baton run "task"`
- `relay-baton handoff --to claude`
- `relay-baton compact`
- `relay-baton squeeze`
- `relay-baton budget`
- `relay-baton compress <file>`
- `relay-baton status`
- `relay-baton tui`
- `relay-baton project add/list/switch/current/remove/doctor`

Project-aware commands use `--path` > `--project` > active project > cwd. `compress <file>` stays cwd-based in v0.2.

## TUI v0.2

Keep Ink. Build a project/session dashboard showing active project, registered projects, diet, agents, session status, changed files, compact state, token budget, log tail, and recent errors.

Supported keys: `q`, `r`, `p`, `d`, `b`, `h`.

The TUI must not launch Codex or Claude. It may only generate handoff files in no-run mode.

## Session Files

Use `.ai-session/` in the repository root:

- `task.md`, `state.md`, `compact-state.md`, `handoff.md`
- `decisions.md`, `changed-files.md`, `repo-map.md`
- `commands.log`, `errors.md`, `test-results.md`
- `full-diff.patch`, `context-budget.json`, `session.json`

relay-baton may write these files. It must not directly modify user source files.

## Auth and Billing Policy

- Do not call OpenAI / Anthropic API directly.
- Default: subprocess `codex` and `claude`.
- Do not store, print, or write API keys.
- Do not pass `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` to children unless explicitly allowed.

```json
{
  "authPolicy": {
    "mode": "cli-session",
    "allowApiKeyEnv": false,
    "warnIfApiKeyEnvDetected": true,
    "blockedEnvVars": ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"]
  }
}
```

## Token Diet

- profiles: off / lite / balanced (default) / caveman / ultra
- character budget based, not exact tokenizer
- caveman = aggressive minimal-context, not silly wording
- inline-ban: full logs, full diff, AGENTS.md, CLAUDE.md
- reference instead of duplicate

## Quality Gates

HandoffQualityGate verifies handoff.md sections exist and required artifacts are present.
TokenDietQualityGate verifies handoff.md size, presence of Token Diet Summary, no inline of full logs / instruction files, profile-specific budgets.

Use `--force` to override; otherwise block.

## Forbidden in MVP

- LLM API client
- semantic summarization
- exact tokenizer
- auto commit / push / PR
- tmux session manager
- IDE extension code
- daemon

## Response Style

Be concise. Short technical bullets. Reference files rather than pasting them.
