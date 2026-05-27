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
- ProjectManager / ProjectRegistry / ProjectResolver
- HandoffGenerator + Quality Gates
- Token Diet modules
- Project/session dashboard TUI
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

## Project 관리

- 여러 repository는 `~/.relay-baton/projects.json`에 등록한다.
- 기존 명령은 `--path` > `--project` > active project > cwd 순서로 repoRoot를 결정한다.
- project가 없어도 기존처럼 cwd 기준으로 동작해야 한다.
- `compress <file>`은 v0.2에서 cwd 기준을 유지한다.

## TUI 방향

- Ink를 유지한다.
- project/session dashboard 중심으로 구현한다.
- TUI에서 Codex/Claude 실제 실행은 하지 않는다.
- 허용되는 실행성 작업은 handoff `--no-run` 생성까지다.

## Repository 탐색 규칙

- 다음 디렉터리는 기본 제외: `node_modules`, `.git`, `dist`, `build`, `.next`, `.turbo`, `coverage`, `bin`, `obj`, `.ai-session`.
- README 탐색은 루트 `README.md`를 우선한다.
- dependency 내부의 README/소스는 작업 대상이 아니다.
- `rg` / `grep` 사용 시 위 디렉터리를 제외하는 옵션을 사용해라.

## Agent CLI 실행 옵션 (참고)

- Codex 기본: `codex exec --sandbox workspace-write "<task>"`.
  - `--full-auto`, `--ask-for-approval` 옵션은 사용하지 않는다 (deprecated 또는 미지원).
- Claude Code 기본: `claude --permission-mode acceptEdits -p "<prompt>"`.
  - `bypassPermissions`는 사용하지 않는다.
  - 처음 실행 시 `claude` 단독 실행 후 `/login`이 필요할 수 있다.

## 테스트

```
pnpm build
pnpm test
```
