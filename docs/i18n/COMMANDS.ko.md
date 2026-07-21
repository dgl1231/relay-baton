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

### `session export <archive> --to <dir> [--overwrite] [--json]`
보관된 세션(id 또는 path)을 공유/백업용으로 대상 디렉터리에 복사한다. 아카이브는
읽기 전용이며 `<dir>/<id>`에만 쓴다. 대상이 이미 있으면 `--overwrite` 없이는
덮어쓰지 않는다.

### `session prune [--max-age-days <n>] [--max-count <n>] [--apply] [--json]`
세션 아카이브 루트에 보존 정책을 적용한다. **기본 비활성** — `--max-age-days`/
`--max-count`가 없으면 아무것도 prune하지 않는다. 주어진 제약을 하나라도 위반하면
prune 후보(N일보다 오래됨, 또는 최신 N개 밖). **기본 dry-run**: 후보만 미리보고
`--apply`일 때만 삭제한다. `createdAt`을 알 수 없는 아카이브는 나이 기준으로 절대
prune하지 않는다.

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
상태와 **아티팩트 스키마 버전**(`migrate` 참고)을 검증한다.
[ARTIFACTS.md](../ARTIFACTS.md) 참고.

### `migrate [--check] [--apply] [--dry-run] [--json]`
버전드 `.ai-session` 아티팩트(`session.json`, `git-baseline.json`, `checkpoints.jsonl`)의 스키마
버전을 현재 계약(`ARTIFACT_SCHEMA_VERSIONS`)과 비교해 안내한다: `ok`, `outdated`(현재보다
구버전), `ahead`(더 새 CLI가 작성), `legacy`(`schemaVersion` 필드 없음 — v1로 간주),
`unreadable`. 기본 동작(및 `--check`)은 읽기 전용.

`--apply`를 주면 안전한 마이그레이션이 실행된다: **legacy 정규화**가 `schemaVersion`이
없는 아티팩트에 현재 버전을 stamp한다. 변경마다 먼저 timestamp `.bak.<ts>` 백업을 쓰며,
`--apply --dry-run`은 쓰지 않고 계획만 미리 본다. 버전 간 업그레이드는 보고되지만 해당
migrator가 등록될 때(첫 실제 스키마 버전 bump)까지 skip된다. 멱등적이다.

### `verify [--diet] [--real-agents] [--keep-temp] [--verbose]`
임시 repo를 대상으로 파이프라인 end-to-end 시뮬레이션 점검. 실제 agent를 절대
실행하지 않는다(`--real-agents`는 scaffold 전용).

### `login [agent] [--allow-api-key-env]`
Codex / Claude Code 대화형 login 실행. `agent`는 `codex` | `claude` | `all`(기본
`all`).

## 실행 & handoff

### `run <task>`
**relay chain**을 실행: 첫 agent가 작업을 수행하고, usage/rate/token/context/quota
fallback 신호가 오면 handoff를 만들어 다음 agent로 넘긴다. 체인 결정(v2.3):
`--chain a,b,c` > `--primary`/`--fallback` > 프로젝트 override > config. 역방향
(claude→codex)과 N-way 체인 지원. 옵션: `--diet`, `--force`,
`--allow-api-key-env`, `--pretty`, `--project`, `--path`, `--until <n>`(+`--yes`,
v2.5 bounded auto-orchestration — 확인 우선, guardrail로 게이트).

**친화적 agent 스트림 (`--pretty`):** agent CLI의 기계용 이벤트 스트림
(`claude -p --output-format stream-json --verbose`, `codex exec --json`)을
요청해서 raw 출력 대신 읽기 좋은 줄로 렌더링한다:

```
● model claude-sonnet-5 · session abc123
  · thinking: need to look at the failing test first
→ Bash: pnpm test --filter core
Fixed the flaky test — two files changed.
✓ agent turn done — in 10,231 tok · out 1,892 tok · $0.0231 · 48.2s
```

결정적 JSONL 줄 단위 파싱만 사용한다 — 모델 호출/요약 없음. 파싱 안 되는 줄과
구조화 모드가 없는 agent는 raw 그대로 통과하고, 전체 raw 스트림은 여전히
`.ai-session/commands.log`에 남으며, fallback 감지도 raw 줄 기준으로 계속
동작한다. 구버전 agent CLI가 플래그를 지원하지 않을 수 있어 옵트인이다.
`plan` / `execute` / `handoff`에서도 사용 가능.

**핸드오프 트리거 확장 (v2.8):** 깨끗이 끝난 뒤에도 바통 터치를 제안할 수 있다:
- `--handoff-now` — 수동 트리거: fallback 신호를 기다리지 않고 각 hop 후 다음
  agent로 relay (플래그 자체가 명시적 동의).
- 선택 설정 `handoffTriggers` (`budgetRatio` 0..1 / `changedFiles` /
  `usageTokensProxy`) — 임계치 도달 시 `hand off to <agent> now? [y/N]` 확인
  (`--yes`로 사전 승인). 설정이 없으면 기존 에러패턴 감지만. stdin이 TTY가
  아니면 프롬프트는 자동 거절된다(무한 대기 없음).

**advisory 라우팅 힌트 (v2.8):** 작업 문자열이 다른 agent의 registry `strengths`
태그와 더 잘 맞으면 `run`이 한 줄 제안을 출력한다. 표시 전용 — 실제 체인은 절대
바꾸지 않으며 명시적 `--chain`/`--primary`가 있으면 힌트도 억제된다.

**종료 코드 (`run` / `execute`):** `0` 성공 · `1` agent를 spawn하지 못함
(미설치 / PATH에 없음) · `2` 사용 오류(git 저장소 아님, 알 수 없는 agent/diet)
· `3` quality gate가 handoff를 차단 · **`4` 체인이 non-zero로 종료한 agent에서
끝남**(정상 종료와 구분되는 실패 종료 — 데스크톱 실행 카드는 이때 chip을 빨간색
으로 표시한다).

### `route <task> [--json]`
v2.8 **advisory 라우팅 힌트**의 읽기 전용 미리보기: `run`과 동일하게 체인을
결정한 뒤(플래그 > work-item 할당 > 프로젝트 > config), registry `strengths`
태그가 이 작업에 대해 순서를 어떻게 제안하는지 agent별 매칭 키워드와 함께
보여준다. agent를 실행하지 않고 세션 상태도 쓰지 않는다. 옵션: `--primary`,
`--fallback`, `--chain`, `--project`, `--path`.

### `handoff --to <agent>`
handoff 문서를 생성하고 선택적으로 다음 agent 실행. 옵션: `--to <agent>`(필수,
예: `claude`), `--diet`, `--force`, `--no-run`(실행 안 함), `--allow-api-key-env`,
`--pretty`.

`run`과 `handoff`는 **Redaction Gate**를 적용한다: 생성된 handoff(다음 agent가 읽는
내용)를 secret/API key/private key에 대해 스캔하고, high-severity finding이 있으면
`--force` 없이는 다음 agent 실행을 차단한다. 절대 home 경로/과대 콘텐츠는
medium-severity 경고만.

`--allow-api-key-env`는 audit된다: 차단 대상 provider key env를 child agent로
통과시키면 relay-baton이 변수 **이름만**(값은 읽지/기록/저장하지 않음) conversation
이벤트로 남긴다.

### `handoff history`
과거 handoff 문서 목록(현재 + 타임스탬프 백업).

### `handoff show [--file <name>] [--json]`
handoff 문서를 읽기 전용으로 출력(기본은 현재 `handoff.md`, `--file`로
`handoff history`의 파일 이름 지정 가능). desktop webview 같은 display
surface가 `.ai-session/`을 직접 만지지 않고 CLI를 통해 읽도록 하기 위한 명령.

### `handoff bundle [--json] [--dry-run] [--out <dir>]`
큐레이션된 `.ai-session` 아티팩트(handoff, compact state, repo map, plan +
receipts, decisions, changed files, test results, errors, session.json)와 git
요약을 `~/.relay-baton/handoff-bundles`(또는 `--out`) 아래 timestamp 디렉터리로
묶는 작고 portable한 **handoff 번들**. `manifest.json`(파일별 size + SHA-256)과
결정적 **redaction 패스**(명백한 secret, API key, 절대 home 경로, 과대 파일)
결과인 `redaction.json`을 쓴다. 소스 저장소는 읽기 전용, 모델 호출 없음.

### `handoff inspect <bundle> [--json] [--out <dir>]`
id나 path로 번들을 manifest와 비교 검증(파일별 존재 + size + SHA-256)하고 내용을
출력한다 — repoRoot, createdAt, git 요약, 파일 수, 무결성, 기록된 redaction
findings. 아무것도 적용하지 않는다.

### `report [--out <file>] [--json]`
기존 아티팩트만으로 사람이 읽는 **마크다운 상태 리포트**(task, status, git, 실행
체크포인트, handoff 발췌)를 생성한다. PR 코멘트/이슈/팀 챗용. stdout으로 출력하거나
`--out <file>`로 저장. 읽기 전용, 모델 호출 없음.

## plan / execute

### `plan <task>`
plan-execute 모드: planner agent가 `.ai-session/plan.md`를 작성. 옵션:
`--with`/`--planner <agent>`, `--executor <agent>`, `--no-run`(빈 템플릿 생성),
`--then-execute`(통과 시 execute 실행), `--diet`, `--force`, `--allow-api-key-env`,
`--pretty`.

### `execute`
plan-execute 모드: executor agent가 `.ai-session/plan.md`를 구현. 옵션:
`--with <agent>`, `--from <path>`, `--diet`, `--force`, `--allow-api-key-env`,
`--pretty`.

### `receipt done <step> [--note]` / `receipt skip <step> [--note]` / `receipt list [--json]`
plan step에 대한 append-only 실행 receipt(`<step>`는 1-based 인덱스).

### `checkpoint add <step> [--command <s>] [--result ok|fail|pending] [--note <s>] [--json]`
bounded execute step에 대한 append-only **실행 체크포인트**를 기록(`<step>`는
1-based 인덱스). 각 체크포인트는 결정적·읽기 전용 스냅샷을 담는다: command
미리보기, 변경 파일 목록, git 요약(branch/head/changed/clean), budget
스냅샷(active profile + handoff chars), result, 타임스탬프. 체크포인트는 다시
쓰지 않는다 — 정정은 새 체크포인트이며 `.ai-session/checkpoints.jsonl`에 한 줄당
JSON 하나로 저장된다. 모델 호출 없음.

### `checkpoint list [--json]`
기록된 실행 체크포인트를 순서대로 나열한다. 깨진 줄은 건너뛴다.

### `checkpoint summary [--json]`
기록된 체크포인트에서 파생한 compact한 handoff/archive/review용 **실행
receipt**: 총 개수, 결과 분포(ok/fail/pending), 마지막 step/command/result,
한 step 내 최대 변경 파일 수, 최신 budget 스냅샷. 결정적·읽기 전용, 모델 호출 없음.

### `guard [--json] [--exit-code]`
기록된 체크포인트와 실시간 git/budget 상태를 **stop-condition 가드레일**과 비교해
실행을 멈춰야 하는지 보고한다. 결정적·읽기 전용 — agent를 직접 멈추지 않고
relay-baton은 보고만 하며 human/agent가 결정한다. cap은 `guardrails` config
블록에서 온다(기본값: `maxSteps` 25, `maxChangedFiles` 40, `maxBudgetRatio` 0.9,
`requireConfirmation` true). `--exit-code`를 주면 stop condition 발생 시 non-zero(10)로
종료해 script/agent 루프가 멈출 수 있다. 없으면 항상 0으로 종료한다.

### `risk [--json]`
git status에서 워킹 트리의 **위험 표면**을 결정적으로 표시한다: dependency
manifest/lockfile, 파일 삭제(high severity), release/CI 편집, env/build config
변경, binary/생성 artifact. 각 finding은 category·severity·reason을 담는다.
읽기 전용, 모델 호출 없음.

### `workspace [--json]`
manifest/config 파일에서 바로 만든 결정적·bounded **workspace map**: 감지된
package manager, 언어, monorepo 패키지, npm script(build/test/lint + 기타), entry
point, docs, AGENTS/CLAUDE 파일. 알려진 manifest 외 파일 내용 스캔 없음, semantic
indexing 없음, 모델 호출 없음.

### `profile [--json]`
workspace map에 config와 등록된 project 기본값을 결합한 결정적 **project profile
힌트**: framework 태그, 권장 build/test 명령(명시적 config 명령이 우선, 없으면
script + package manager에서 파생), diet/agent 기본값, 제외 경로, entry point.
읽기 전용.

### `inventory [--json]`
package script, workspace package(스크립트 포함), CI workflow, release 파일,
dependency manifest의 bounded **인벤토리**. 알려진 manifest/config 위치만 읽으며,
전체 저장소 스캔 없음, 모델 호출 없음.

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
