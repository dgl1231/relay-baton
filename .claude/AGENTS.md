# AGENTS.md

이 repository는 `relay-baton` 프로젝트다.

## 프로젝트 목적

Codex CLI와 Claude Code CLI 사이에서 작업을 이어받게 하는 local handoff harness를 만든다.

핵심 기능:
- Codex 실행
- fallback pattern 감지
- handoff 파일 생성
- Claude Code continuation prompt 생성
- token diet compaction
- CLI/TUI 제공

## MVP 범위

구현:
- TypeScript / Node.js / pnpm monorepo
- core / cli / tui 분리
- CodexAdapter
- ClaudeCodeAdapter
- FallbackDetector
- GitService
- RepoMapGenerator
- HandoffGenerator
- Token Diet modules
- Vitest tests

제외:
- API 직접 호출
- 자동 commit/push/PR
- daemon
- VS Code extension
- Visual Studio extension
- tmux manager
- semantic summarization
- exact tokenizer

## 보안/과금 정책

이 도구는 OpenAI API 또는 Anthropic API를 직접 호출하지 않는다.

기본 실행 방식:
- local `codex` CLI subprocess
- local `claude` CLI subprocess

기본적으로 child process에 전달하지 말아야 할 env:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

API key 값은 절대 로그에 남기지 않는다.

## Token Diet

handoff.md는 작아야 한다.

큰 정보는 파일에 저장하고 참조한다.

- full diff: `.ai-session/full-diff.patch`
- full logs: `.ai-session/commands.log`
- compact state: `.ai-session/compact-state.md`
- repo map: `.ai-session/repo-map.md`

## 테스트

가능하면 변경 후 실행:

```bash
pnpm build
pnpm test
