# CLAUDE.md

이 프로젝트는 `relay-baton`이다.

Codex CLI에서 Claude Code CLI로 작업을 이어받게 만드는 로컬 handoff harness이며, token diet harness다.

## 핵심 목표

- Codex CLI를 먼저 실행한다.
- Codex가 usage/rate/token/context/quota 문제로 멈추면 fallback을 감지한다.
- 현재 repository 상태를 기준으로 handoff를 생성한다.
- Claude Code가 이어서 작업하도록 continuation prompt를 만든다.
- 전체 로그/전체 diff/전체 repo를 붙여넣지 않고 compact handoff를 만든다.

## 중요한 제한

하지 말 것:
- OpenAI / Anthropic API 직접 호출
- API key 저장 / 출력 / `.ai-session` 기록
- 자동 commit / push / PR
- 실시간 agent chat platform 구현
- tmux manager / VS Code / Visual Studio extension
- semantic summarization, exact tokenizer

MVP에서는 deterministic compaction만 구현한다.

## 기본 기술 스택

- TypeScript, Node.js 20+
- pnpm workspace
- commander, Ink (TUI)
- vitest
- `child_process.spawn`, git CLI

## 구조 원칙

- `packages/core`는 UI 독립
- `packages/cli`는 core 호출만
- `packages/tui`는 business logic을 갖지 않음
- agent별 Adapter 분리, MVP는 Codex/Claude만

## 인증 정책

- local CLI subprocess로 연결
- 기본 차단 env: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- `--allow-api-key-env`가 있을 때만 전달

## Token Diet 원칙

- 모든 내용을 handoff.md에 넣지 마라.
- 전체 diff → `.ai-session/full-diff.patch`
- 전체 로그 → `.ai-session/commands.log`
- 압축 상태 → `.ai-session/compact-state.md`
- AGENTS.md / CLAUDE.md 내용을 handoff.md에 복붙하지 않는다.

## Caveman profile

장난스러운 말투가 아니라 aggressive minimal-context를 의미한다.
짧은 기술 bullet, filler 제거, 파일 참조 우선, 기술 정확도 유지.

## 작업 방식

큰 변경 전:
1. 현재 구조를 확인한다.
2. 구현 계획을 짧게 말한다.
3. 작은 단위로 구현한다.
4. 테스트를 추가한다.
5. `pnpm build`, `pnpm test`를 실행한다.
6. 실패하면 원인과 다음 조치를 남긴다.

응답은 간결하게 한다.
