# relay-baton

> Token-aware handoff harness for Codex CLI and Claude Code

relay-baton은 Codex CLI에서 Claude Code CLI로 작업을 이어받게 만드는 로컬 작업 인수인계 하네스다. 동시에 coding agent가 불필요한 context를 너무 많이 읽지 않도록 줄여주는 token diet harness이기도 하다.

## relay-baton이 하는 일

- Codex CLI를 먼저 실행한다.
- Codex 출력에서 usage/rate/token/context/quota 패턴을 감지한다.
- 현재 repository 상태(git status, diff, repo map)를 기준으로 compact handoff를 만든다.
- Claude Code가 이어서 작업하도록 continuation prompt를 만든다.
- 큰 정보(전체 diff, 전체 로그)는 `.ai-session/` 파일에 저장하고 handoff.md에서 참조만 한다.

## relay-baton이 아닌 것

- 실시간 agent chat platform이 아니다.
- LLM API client가 아니다 (OpenAI/Anthropic API 직접 호출 없음).
- 자동 PR/commit/push 도구가 아니다.
- IDE 확장, tmux session manager가 아니다.

## 요구사항

- Node.js 20+
- pnpm 9+
- git CLI
- `codex` CLI (선택, primary agent로 사용 시)
- `claude` CLI (선택, fallback agent로 사용 시)

## 설치

```bash
pnpm install
pnpm build
```

## 기본 사용법

```bash
pnpm relay-baton init
pnpm relay-baton doctor
pnpm relay-baton run "메일 첨부파일 업로드 흐름을 고쳐줘"
pnpm relay-baton run "메일 첨부파일 업로드 흐름을 고쳐줘" --diet caveman
pnpm relay-baton handoff --to claude
pnpm relay-baton handoff --to claude --diet caveman
pnpm relay-baton handoff --to claude --no-run
pnpm relay-baton compact
pnpm relay-baton squeeze --diet caveman
pnpm relay-baton budget
pnpm relay-baton compress CLAUDE.md
pnpm relay-baton status
pnpm relay-baton tui
```

`pnpm relay-baton`은 `node packages/cli/dist/index.js`의 alias다. `pnpm build` 후 동작한다.

## Codex → Claude Code handoff 흐름

1. `relay-baton run "..."`이 Codex CLI를 subprocess로 실행한다.
2. stdout/stderr를 실시간 표시하고 `.ai-session/commands.log`에 append한다.
3. 출력에서 fallback pattern을 case-insensitive로 감지한다.
4. fallback이 감지되면 git 상태 수집, repo map 생성, compact state 생성, handoff 작성.
5. HandoffQualityGate + TokenDietQualityGate 통과 후 Claude Code를 실행한다.
6. Claude Code는 `.ai-session/handoff.md`와 참조 파일을 기준으로 작업을 이어받는다.

## Token Diet Mode

relay-baton은 다음 원칙으로 토큰을 절약한다.

- 전체를 붙여넣지 않는다.
- raw log 대신 log tail + known errors.
- full source 대신 repo map.
- 전체 diff 대신 focused diff (lock/build/min 파일 제외).
- 큰 정보는 파일 참조로 처리.

### Diet Profiles

- `off` — truncation 최소화.
- `lite` — 빈 줄, 중복 instruction 제거.
- `balanced` — 기본. compact state + diff summary + log tail + repo map.
- `caveman` — aggressive minimal-context. 짧고 직접적인 기술 bullet, full diff/log inline 금지.
- `ultra` — 극단 압축. 거의 모든 큰 정보를 reference로 넘김.

`caveman`은 장난스러운 말투가 아니다. 기술 정확도는 유지된다.

relay-baton의 aggressive token diet profile은 caveman 같은 terse agent-output compression 도구에서 영감을 받았지만, relay-baton은 repository handoff, compact state, cross-agent continuation에 집중합니다.

## 명령어

- `relay-baton init` — `.ai-session/` 생성.
- `relay-baton doctor` — git/codex/claude 가용성, API key env 경고, config 점검.
- `relay-baton run "<task>"` — Codex 실행 + fallback 감지 + Claude로 이어받기.
- `relay-baton handoff --to claude [--diet ...] [--no-run] [--force]` — 수동 handoff.
- `relay-baton compact [--diet ...]` — compact-state, repo-map, full-diff 재생성.
- `relay-baton squeeze` — compact의 alias.
- `relay-baton budget` — 현재 context budget 사용량 출력.
- `relay-baton compress <file> [--write] [--out path]` — 결정적 markdown 압축.
- `relay-baton status` — 세션 상태 출력.
- `relay-baton tui` — Ink 기반 minimal TUI (q로 종료).

## `relay-baton.config.json`

```json
{
  "primaryAgent": "codex",
  "fallbackAgent": "claude",
  "agents": {
    "codex": { "command": "codex", "args": ["exec"] },
    "claude": { "command": "claude", "args": ["-p"] }
  },
  "fallbackPatterns": [
    "usage limit", "rate limit", "context length",
    "context limit", "token limit", "quota",
    "exhausted", "maximum context", "too many requests"
  ],
  "commands": { "test": "", "build": "" },
  "authPolicy": {
    "mode": "cli-session",
    "allowApiKeyEnv": false,
    "warnIfApiKeyEnvDetected": true,
    "blockedEnvVars": ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"]
  },
  "tokenDiet": {
    "enabled": true,
    "profile": "balanced",
    "outputCompression": true
  }
}
```

설정 파일이 없으면 default가 적용된다.

## `.ai-session/` 파일

- `task.md` — 사용자 요청 작업.
- `state.md` — 현재 상태 (Goal/Done/In Progress/Remaining/Decisions/Risks/Next Step).
- `compact-state.md` — state.md를 결정적으로 압축한 형태.
- `handoff.md` — 다음 에이전트용 인수인계 문서.
- `decisions.md` — 결정 기록.
- `changed-files.md` — 변경 파일 목록.
- `repo-map.md` — 디렉터리 트리 + 키 파일.
- `commands.log` — Codex/Claude 실행 로그 (append-only).
- `errors.md` — 에러 메모.
- `test-results.md` — 테스트/빌드 결과.
- `full-diff.patch` — `git diff HEAD` snapshot.
- `context-budget.json` — diet 사용량 스냅샷.
- `session.json` — 세션 메타.

## Handoff Quality Gate

- 필수 파일 존재 + 비어있지 않음.
- handoff.md 안에 `Goal`, `Previous Agent`, `Next Agent`, `Changed Files`, `Known Errors`, `Next Steps` 섹션 존재.
- 통과 못하면 fallback agent를 실행하지 않는다. `--force`로 우회 가능.

## Token Diet Quality Gate

- `handoff.md` ≤ `maxHandoffChars`.
- `Token Diet Summary` 섹션 존재.
- 큰 truncate marker 포함 여부 확인.
- `commands.log`/`AGENTS.md`/`CLAUDE.md` inline 금지.
- `caveman`/`ultra` profile에서 Important Diff 블록 크기 제한.

## Auth / Billing Safety

- relay-baton은 API key를 저장/출력/`.ai-session` 기록하지 않는다.
- 기본적으로 `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`는 child process에 전달되지 않는다.
- `--allow-api-key-env` 또는 `authPolicy.allowApiKeyEnv=true`인 경우에만 전달한다.
- `doctor`는 key 값을 출력하지 않고 set 여부만 알려준다.

## Safety

- git repo가 아니면 `run`/`handoff`를 중단한다.
- 기존 `handoff.md`는 timestamp suffix로 자동 backup한다.
- `commands.log`는 append-only.
- relay-baton은 사용자 소스 파일을 직접 수정하지 않는다 (`.ai-session/`만 수정).
- `compress` 명령은 `--write` 없이는 원본을 덮어쓰지 않는다.

## 현재 제한사항 (MVP)

- LLM/tokenizer 호출 없음. character budget으로 동작.
- semantic summarization 없음. deterministic compaction만.
- agent adapter는 Codex/Claude만.
- TUI는 read-only 정보 표시. 입력 기능은 q 종료뿐.

## Roadmap

- OpenCode / Gemini / Aider adapter.
- model별 tokenizer 옵션.
- compact state SemanticDiff.
- session 다중 관리 / TUI command palette.
- daemon / IDE extension (별도 패키지).

## Design Principle

1. chat relay가 아니라 work handoff다.
2. 대화 기록보다 현재 repository 상태가 우선이다.
3. handoff는 사람이 읽어도 이해 가능해야 한다.
4. 모든 UI는 core를 호출하는 껍데기다.
5. token diet는 부가 기능이 아니라 핵심 기능이다.
