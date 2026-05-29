# relay-baton 명령어 레퍼런스 (v1.0)

`relay-baton` CLI 전체 레퍼런스. relay-baton은 로컬 handoff + token-diet
harness다. Codex CLI를 먼저 실행하고, fallback을 감지하고, Claude Code가 이어서
작업하도록 compact handoff를 만든다. 모델 API를 직접 호출하지 않고, API key를
저장/출력하지 않으며, 자동 commit/push/PR을 하지 않는다.

## 공통 규칙

대부분의 명령은 아래 project 지정 옵션을 받는다. repoRoot 결정 우선순위는
`--path` > `--project` > active project > 현재 작업 디렉터리(cwd)다.

| 옵션 | 의미 |
| --- | --- |
| `--path <repoPath>` | 명시적 repository 경로로 동작. |
| `--project <name-or-id>` | 등록된 project 대상. |
| `--diet <profile>` | token-diet 프로파일: `off` \| `lite` \| `balanced` \| `caveman` \| `ultra`. |
| `--json` | 기계 판독용 JSON 출력(지원 명령에 한함). |
| `--allow-api-key-env` | `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`를 child process에 전달. 기본 차단. |
| `--force` | quality-gate 실패를 무시. |

## 세션 생명주기

### `init`
대상 repository에 `.ai-session/`를 초기화(멱등적, 기존 파일 덮어쓰지 않음).

### `status [--json]`
현재 세션 상태(`session.json` 요약) 표시.

### `doctor [--deep]`
로컬 환경 점검: git, agent CLI, auth env 존재 여부(값은 출력 안 함),
`.ai-session`. `--deep`는 추가로 **config 계약**(`validateConfig`)과 **아티팩트
형태**(`validateArtifacts`), 도구/adapter args/registry/plan/handoff/compression
상태를 검증한다. [ARTIFACTS.md](../ARTIFACTS.md) 참고.

### `verify [--diet] [--real-agents] [--keep-temp] [--verbose]`
임시 repo를 대상으로 파이프라인 end-to-end 시뮬레이션 점검. 실제 agent를 절대
실행하지 않는다(`--real-agents`는 scaffold 전용).

### `login [agent] [--allow-api-key-env]`
Codex / Claude Code 대화형 login 실행. `agent`는 `codex` | `claude` | `all`(기본
`all`).

## 실행 & handoff

### `run <task>`
Codex CLI를 먼저 실행하고, usage/rate/token/context/quota fallback 시 handoff를
생성해 Claude Code를 실행. 옵션: `--diet`, `--force`, `--allow-api-key-env`,
`--project`, `--path`.

### `handoff --to <agent>`
handoff 문서를 생성하고 선택적으로 다음 agent 실행. 옵션: `--to <agent>`(필수,
예: `claude`), `--diet`, `--force`, `--no-run`(실행 안 함), `--allow-api-key-env`.

### `handoff history`
과거 handoff 문서 목록(현재 + 타임스탬프 백업).

## plan / execute

### `plan <task>`
plan-execute 모드: planner agent가 `.ai-session/plan.md`를 작성. 옵션:
`--with`/`--planner <agent>`, `--executor <agent>`, `--no-run`(빈 템플릿 생성),
`--then-execute`(통과 시 execute 실행), `--diet`, `--force`, `--allow-api-key-env`.

### `execute`
plan-execute 모드: executor agent가 `.ai-session/plan.md`를 구현. 옵션:
`--with <agent>`, `--from <path>`, `--diet`, `--force`, `--allow-api-key-env`.

### `receipt done <step> [--note]` / `receipt skip <step> [--note]` / `receipt list [--json]`
plan step에 대한 append-only 실행 receipt(`<step>`는 1-based 인덱스).

## token diet

### `compact` (별칭 `squeeze`)
compact-state, repo-map, diff 스냅샷 재계산. 옵션: `--diet`.

### `compress-context [--threshold <ratio>] [--dry-run] [--force]`
budget 초과 시 실행 중 세션 컨텍스트(`state.md` / `commands.log`) 압축.
`--threshold`는 `0..1` 비율, `--dry-run`은 쓰기 없이 보고.

### `compress <file> [--write] [--out <path>]`
단일 markdown/instruction 파일을 deterministic하게 압축.

### `budget [--json]`
context-budget 사용량 표시.

## Agent Room & replay

### `chat` (별칭 `room`)
Agent Room: 턴 기반, confirmation-first 멀티 agent REPL. 옵션
`--allow-api-key-env`. room 내부 명령: `handoff`, `run`, `plan`, `execute`,
`review`, `diagnose`, `budget`, `status`, `continue`, `replan`, `replay`.
[AGENT_ROOM.md](../AGENT_ROOM.md) 참고.

### `replay [--json] [--session <id>] [--kind <kinds>] [--limit <n>]`
기록된 대화 타임라인(`conversation.jsonl`) 재생, 읽기 전용.

### `review [--json]`
working-tree diff를 현재 plan과 deterministic하게 검토(모델 호출 없음).

## projects

### `project add <path> [--name] [--diet] [--primary] [--fallback]`
repository를 project로 등록.

### `project list` / `project current` / `project switch <name-or-id>` / `project remove <name-or-id>` / `project doctor`
project registry 관리(기본 `~/.relay-baton/projects.json`).

## TUI

### `tui`
Ink 기반 project/session 대시보드 시작. 키: `q` 종료, `r` 새로고침, `p` 다음
project, `d` diet 순환, `b` budget 리로드, `h` handoff(no-run). TUI는 실제 agent를
실행하지 않는다.
