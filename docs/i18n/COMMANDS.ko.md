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

### `session archive [--json] [--dry-run] [--out <dir>]`
현재 `.ai-session/` artifact를 source repository를 수정하지 않고 local
relay-baton archive directory로 보관한다.

v1.6 첫 cut은 directory archive와 file size/SHA-256 checksum을 담은
`manifest.json`을 쓴다. prune/delete/zip/upload/source project mutation은 하지
않는다.

### `session list [--json] [--out <dir>]`
archive root(기본 `~/.relay-baton/session-archives`) 아래의 보관 세션을 최신순으로
나열한다. read-only: 각 `manifest.json`을 읽어 id, file 수, 총 bytes, `createdAt`을
보고한다. manifest가 없거나 깨진 archive는 `valid: false`로 표시한다. archive root가
없으면 깔끔하게 degrade한다.

### `session inspect <archive> [--json] [--out <dir>]`
id나 path로 지정한 archive 하나를 `manifest.json` 기준으로 검증한다. `repoRoot`,
`createdAt`, file 수, 총 bytes, file별 무결성(존재 + size + SHA-256)을 보고한다.
`missing`/`corrupt` 목록과 `intact` 플래그로 결과를 요약한다. read-only: 복사/적용/
복원은 하지 않는다.

### `session resume [--json] [--stale-hours <n>]`
현재 `.ai-session`을 진단하고 가장 안전한 다음 명령을 제안한다. 필수 파일 존재 여부,
`session.json` 유효성/schema, git baseline drift, `updatedAt` 경과시간(기본 stale
임계 24h)을 보고 세션을 `missing`/`incomplete`/`stale`/`ok`로 분류한다. read-only:
읽고 추천만 하며 제안한 명령을 실행하지 않는다. 대표 제안: `init`(재scaffold),
`status`/`replay`(컨텍스트 재개), `review`/`handoff`/`session archive`(stale).

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

### `handoff show [--file <name>] [--json]`
handoff 문서를 읽기 전용으로 출력(기본은 현재 `handoff.md`, `--file`로
`handoff history`의 파일 이름 지정 가능). desktop webview 같은 display
surface가 `.ai-session/`을 직접 만지지 않고 CLI를 통해 읽도록 하기 위한 명령.

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

### `conversation append <text> [--role <role>] [--kind <kind>] [--json]`
현재 project session의 `conversation.jsonl`에 이벤트 하나를 추가한다. desktop은
session 파일을 직접 쓰지 않고 이 명령으로 composer 메시지와 command echo를 기록한다.
초기화된 `.ai-session`이 필요하다.

### `review [--json]`
working-tree diff를 현재 plan과 deterministic하게 검토(모델 호출 없음).

## projects

### `project add <path> [--name] [--diet] [--primary] [--fallback] [--json]`
존재하는 디렉터리를 project로 등록한다. git repository가 아니어도 등록은 가능하지만,
`run`/`handoff`처럼 git 기반 명령은 여전히 git repository가 필요하다. `--json`은
sidecar/GUI 연동용으로 `{ added, project }`를 출력한다.

### `project list [--json]` / `project current [--json]` / `project switch <name-or-id>` / `project remove <name-or-id> [--json]` / `project doctor`
project registry 관리(기본 `~/.relay-baton/projects.json`).
`list --json` / `current --json`은 display surface(desktop dashboard, script)용
machine-readable 출력. `remove --json`은 `{ removed }`를 출력한다.

## TUI

### `tui`
Ink 기반 project/session 대시보드 시작. 키: `q` 종료, `r` 새로고침, `p` 다음
project, `d` diet 순환, `b` budget 리로드, `h` handoff(no-run). TUI는 실제 agent를
실행하지 않는다.
