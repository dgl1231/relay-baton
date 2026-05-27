# AGENTS.md

이 repository는 `relay-baton` 프로젝트다.

Codex, Claude Code, OpenCode, Gemini 등 coding agent가 공통으로 읽는 지침이다.

## 프로젝트 목적

Codex CLI와 Claude Code CLI 사이에서 작업을 이어받게 하는 local handoff harness.

## MVP 범위

구현:
- TypeScript / Node.js / pnpm monorepo
- core / cli / tui 분리
- CodexAdapter, ClaudeCodeAdapter
- FallbackDetector, GitService, RepoMapGenerator
- HandoffGenerator + Quality Gates
- Token Diet modules
- Vitest tests

제외:
- API 직접 호출
- 자동 commit/push/PR
- daemon, VS Code/Visual Studio extension
- tmux manager
- semantic summarization, exact tokenizer

## 보안/과금 정책

- OpenAI/Anthropic API를 직접 호출하지 않는다.
- 기본 실행 방식은 local `codex` / `claude` CLI subprocess다.
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`는 기본적으로 child process에 전달하지 않는다.
- `--allow-api-key-env` 또는 `authPolicy.allowApiKeyEnv=true`인 경우에만 전달한다.
- API key 값은 로그/세션 파일에 절대 기록하지 않는다.

## Token Diet

handoff.md는 짧게 유지한다. 큰 정보는 파일로 저장하고 참조한다.

- full diff: `.ai-session/full-diff.patch`
- full logs: `.ai-session/commands.log`
- compact state: `.ai-session/compact-state.md`
- repo map: `.ai-session/repo-map.md`

## 테스트

```
pnpm build
pnpm test
```
