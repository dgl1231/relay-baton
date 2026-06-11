<div align="center">

# relay-baton

**코딩 에이전트를 위한 이식 가능한 연속성 인프라**

Codex CLI, Claude Code, 그리고 그 다음에 나올 도구 사이로 — 채팅 로그, diff, 저장소를 다시 붙여넣지 않고 — 압축된 코딩 상태를 넘긴다.

[English](../../README.md)
 · **한국어**
 · [日本語](./README.ja.md)
 · [简体中文](./README.zh-CN.md)
 · [繁體中文](./README.zh-TW.md)
 · [Español](./README.es.md)
 · [Français](./README.fr.md)
 · [Deutsch](./README.de.md)
 · [Português](./README.pt-BR.md)
 · [Русский](./README.ru.md)

</div>

```bash
# Codex가 작업 중 quota 벽에 부딪힘. relay-baton이 감지해서 저장소의
# 실제 상태로 compact handoff를 만들고, Claude에서 그대로 이어받음.
$ relay-baton run "업로드 파이프라인 리팩터" --diet caveman
[relay-baton] codex: ... rate limit exceeded ...
[relay-baton] fallback pattern detected: rate limit exceeded
[relay-baton] building handoff for claude...
[relay-baton] claude resumed from .ai-session/handoff.md
```

---

## 왜 만들었나

AI 코딩 작업은 여러 도구로 흩어지고 있다. 실제 세션은 이런 모양이다:

- 한 묶음은 Codex CLI로, 다른 묶음은 Claude Code로.
- 아침에는 노트북, 저녁에는 다른 머신.
- 가득 차거나, 조용히 잘려나가는 context window.

지금까지 agent 사이로 작업을 옮기는 기본 방법은 **채팅 로그 복붙** — 심하면 저장소 전체를 prompt에 던지는 것이다. 3가지 문제가 있다:

1. **토큰.** 채팅 로그는 대부분 노이즈다. 매 턴 그 노이즈에 돈을 낸다.
2. **연속성.** 다음 agent에게 *의도*가 아니라 transcript가 전달된다.
3. **취약성.** 파일 하나 누락, diff 하나 stale, agent는 잘못된 전제로 재시작한다.

relay-baton은 agent들 아래에 깔리는 **로컬 하네스**다. 인수인계 사이로 *최소 충분 상태*만 운반한다 — compact 요약, repo map, 파일 참조. transcript가 아니다.

> **토큰을 최소한으로 쓰면서 Codex CLI와 Claude Code CLI를 하나의 작업 흐름으로 병합한다.**

## 핵심 아이디어

```
┌─────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────┐
│ Codex   │ → │ Fallback     │ → │ Token Diet   │ → │ Claude │
│ exec    │   │ Detector     │   │ Handoff      │   │ Code   │
└─────────┘   └──────────────┘   └──────────────┘   └────────┘
                        ↓                ↓
                  .ai-session/handoff.md, compact-state.md,
                  repo-map.md, full-diff.patch, commands.log
```

코딩 agent용 baton-pass — 4단계 primitive:

- **Detect** 현재 agent가 한계에 닿았는지 감지 (quota, context, rate, errors).
- **Capture** 중요한 것만 수집 (repo 상태, 변경 파일, 결정, 다음 단계).
- **Compact** 다음 agent가 실제로 소화할 수 있는 예산 안으로 압축.
- **Hand off** quality gate를 통과한 뒤에만 넘긴다.

handoff는 작은 파일(`.ai-session/handoff.md`) + 참조다. 큰 자료(전체 diff, 전체 로그, 전체 repo map)는 디스크에 두고 필요할 때만 로드한다.

## Quick Start

```bash
pnpm install
pnpm build
pnpm relay-baton login          # Codex + Claude 로그인
pnpm relay-baton doctor         # 환경 점검
pnpm relay-baton run "메일 업로드 흐름을 고쳐줘" --diet balanced
```

## 작업 흐름

```bash
$ relay-baton init                  # .ai-session/ 생성
$ relay-baton run "업로드 테스트 불안정 해결" --diet balanced
... codex 출력 스트림 ...
[relay-baton] fallback pattern detected: maximum context length
[relay-baton] building handoff for claude...
[relay-baton] HandoffQualityGate: ok
[relay-baton] TokenDietQualityGate: ok
... claude가 이어받아서 파일 수정 후 종료 ...

$ relay-baton status                # 세션 상태
$ relay-baton budget                # diet 예산 사용량
```

자동 fallback 없이 수동 handoff만:

```bash
$ relay-baton handoff --to claude --no-run --diet caveman
```

여러 저장소 사이 전환:

```bash
$ relay-baton project add /path/to/repo-a --diet caveman
$ relay-baton project switch repo-a
$ relay-baton run "새 metrics endpoint 연결"
```

## 기능

- **자동 fallback** — Codex 출력에서 `quota exceeded`, `rate limit exceeded`, `maximum context length` 등을 감지. grep 결과와 패턴을 설명하는 산문은 건너뜀 (false positive 방지).
- **Token diet** — 5가지 결정적 압축 profile (`off · lite · balanced · caveman · ultra`). lock/build/min 파일 제외, 로그 tail, repo map.
- **Quality gates** — fallback 실행 *전에* handoff 완전성과 budget을 검증.
- **Auth-safe by default** — `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`는 child process에서 제거. `--allow-api-key-env`로만 opt-in. key를 저장/출력/기록하지 않음.
- **Project registry** — 여러 저장소를 한 번 등록, `--project`/`--path`로 어디서든 실행.
- **Ink TUI** — project/session dashboard. agent는 절대 실행하지 않음.
- **자체 API 호출 없음** — OpenAI / Anthropic API를 직접 호출하지 않음. 로컬 `codex`/`claude` CLI subprocess만 spawn.

## 명령어

| 명령 | 설명 |
|---|---|
| `relay-baton init` | `.ai-session/` 생성 |
| `relay-baton doctor` | 환경 점검 (`--deep` 확장 진단) |
| `relay-baton verify` | 시뮬레이션 end-to-end 점검 — 실제 모델 호출 없음 |
| `relay-baton login [agent]` | Codex / Claude 로그인 흐름 |
| `relay-baton run "<task>"` | primary agent 실행 + fallback 감지 + handoff |
| `relay-baton handoff --to claude` | 수동 handoff (`--diet`, `--no-run`, `--force`) |
| `relay-baton handoff history` | 현재 + 백업 handoff 문서 나열 (metadata만) |
| `relay-baton plan "<task>"` | Plan-execute: planner가 `plan.md` 작성 (`--with`, `--no-run`, `--then-execute`) |
| `relay-baton execute` | Plan-execute: executor가 `plan.md` 구현 (`--with`, `--from`) |
| `relay-baton compress-context` | 진행 중 context(state.md / commands.log) 압축 (`--dry-run`, `--threshold`) |
| `relay-baton compact` / `squeeze` | compact-state / repo-map / full-diff 재생성 |
| `relay-baton budget` | context budget 사용량 |
| `relay-baton compress <file>` | markdown 결정적 압축 |
| `relay-baton status` | 세션 상태 |
| `relay-baton project add/list/switch/current/doctor/remove` | project registry 관리 |
| `relay-baton tui` | Ink dashboard |

Project 인지 명령은 `--project <name-or-id>`와 `--path <repoPath>`를 받는다. 우선순위: `--path` > `--project` > active project > cwd.

## Project registry

```bash
relay-baton project add /path/to/relay-baton --name relay-baton --diet caveman --primary codex --fallback claude
relay-baton project switch relay-baton
relay-baton status --project relay-baton
```

기본 저장 위치는 `~/.relay-baton/projects.json`. `RELAY_BATON_PROJECTS_FILE`로 경로 override 가능 (CI, sandbox, 테스트). 손상된 파일은 `projects.json.corrupt-<timestamp>.bak`로 백업 후 빈 registry로 초기화 — 명령은 그대로 계속 동작.

## Token diet profiles

| Profile | 의도 |
|---|---|
| `off` | truncation 최소화 |
| `lite` | 가벼운 정리 |
| `balanced` *(기본)* | 일반 작업 |
| `caveman` | aggressive minimal-context |
| `ultra` | 극단 압축 |

> `caveman`은 장난스러운 말투가 아니라 **aggressive minimal-context**다. 기술 정확도는 유지한다.

## 대안 비교

| 방식 | 넘기는 것 | 토큰 비용 | 연속성 | 실패 모드 |
|---|---|---|---|---|
| v1.5.0-alpha.0 | [Read →](../../release-notes/v1.5.0-alpha.0.md) | [읽기 →](../../release-notes/ko/v1.5.0-alpha.0.md) | Git tracking first cut: read-only `relay-baton git status --json`, non-git project fallback, desktop Git panel, and `/git` in Agent Room. |
| Raw 채팅 export | 전체 transcript | 높음 (대부분 노이즈) | 취약 — agent가 자기 사고를 다시 읽음 | context window 초과 |
| 복붙 prompting | 사람이 기억한 것 | 가변 | 깨지기 쉬움 | 실제 상태와 silent drift |
| 전체 repo dump | 전부 | 매우 높음 | 강하지만 비쌈 | 모델이 중간에서 잘림 |
| **relay-baton** | compact 요약 + repo map + 파일 참조 | **낮음, profile로 한정** | 강함 — *실제* repo 상태 기준 | quality gate로 *명시적* 실패 |

## 철학

relay-baton은 **AI 네이티브 개발 workflow를 위한 작고 날카로운 도구**다.

- **Local-first.** 모든 것이 디스크에 있다. 클라우드, 데몬, 텔레메트리, 계정 없음.
- **Composability.** `.ai-session/` 디렉토리는 그냥 파일들이다. 읽고, grep하고, diff 뜨고, PR에 첨부할 수 있다.
- **가벼운 상태 전송.** handoff는 markdown 파일이지 데이터베이스가 아니다.
- **영리함보다 결정성.** 하네스 안에서 LLM 요약을 쓰지 않는다 — 모델이 요약을 잘못하면 handoff가 거짓말이 된다. 문자 예산, 구조 규칙, 명시적 참조로만 동작.
- **Repo 상태가 진실의 원천.** 대화는 해석이고, repo는 사실이다.
- **토큰 효율성이 기능 그 자체** — 메뉴에 숨겨진 옵션이 아니다.

### 설계 원칙

1. chat relay가 아니라 **work handoff**.
2. 대화 기록보다 **현재 repository 상태**가 우선.
3. handoff는 **사람이 읽어도** 이해 가능해야 한다.
4. 모든 UI는 core를 호출하는 껍데기다.
5. **Token diet는 부가 기능이 아니라 핵심 기능**이다.

## 미래 방향

relay-baton은 2-agent fallback 하네스로 시작했다. 같은 primitive는 더 멀리 간다:

- **다중-agent relay chain** — Codex → Claude → OpenCode → 다시 Codex.
- **분기되는 session tree** — 같은 작업을 병렬 agent로 시도하고 diff로 화해.
- **원격 relay state** — `.ai-session/`을 공유 remote로 push해서 다음 머신이 이어받음.
- **Orchestrated workflow** — `review`, `diagnose`, `continue` 모드 (명시적 checkpoint를 가진 bounded autopilot).
- **추가 adapter** — OpenCode, Gemini CLI, Aider 등 로컬 subprocess 인터페이스가 있는 모든 것.

하네스의 모양은 그대로다: detect, capture, compact, hand off.

## 요구사항

| 항목 | 버전 / 비고 |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | 필수 |
| `codex` | **ChatGPT Plus 이상 구독 필요** |
| `claude` | **Claude Pro 이상 구독 필요** |

> relay-baton은 OpenAI / Anthropic API를 직접 호출하지 않는다. 로컬 `codex` / `claude` CLI의 **구독 인증**을 사용한다. API key 인증은 가능하지만 **기본 차단** (`--allow-api-key-env` opt-in 필요).

## 로그인

```bash
pnpm relay-baton login           # 둘 다
pnpm relay-baton login codex
pnpm relay-baton login claude
```

`claude --version`이 통과해도 로그인은 별도다. "Not logged in"이 보이면 위 명령을 다시 실행.

## 릴리즈 노트

**최신:** v1.5.0-alpha.1 — [English](../../release-notes/v1.5.0-alpha.1.md) · [한국어](../../release-notes/ko/v1.5.0-alpha.1.md)

| 버전 | English | 한국어 | 한 줄 요약 |
|---|---|---|---|
| v1.4.0-alpha.1 | [Read →](../../release-notes/v1.4.0-alpha.1.md) | [읽기 →](../../release-notes/ko/v1.4.0-alpha.1.md) | Distribution polish: one-line installers with SHA-256 verification, release SHA256SUMS/SBOM metadata, package-manager starter files, optional signing hooks, and a desktop Codex/Claude preview switcher. |
| v1.3.0-alpha.0 | [Read →](../../release-notes/v1.3.0-alpha.0.md) | [읽기 →](../../release-notes/ko/v1.3.0-alpha.0.md) | Desktop conversation + project-scoped sessions: Agent Room composer, persisted conversation events via `conversation append`, visible project/session context, and confirmation-first slash actions. |
| v1.2.0-alpha.3 | [Read →](../../release-notes/v1.2.0-alpha.3.md) | [읽기 →](../../release-notes/ko/v1.2.0-alpha.3.md) | Desktop project management + i18n: add projects with the folder picker, switch/remove projects in the GUI, register non-git project folders, and switch UI chrome between English/Korean/Japanese/Simplified Chinese. |
| v1.2.0-alpha.2 | [Read →](../../release-notes/v1.2.0-alpha.2.md) | [읽기 →](../../release-notes/ko/v1.2.0-alpha.2.md) | Desktop sidecar fix: the GUI now actually reaches the bundled CLI (`withGlobalTauri` + `window.__TAURI__`), so status/budget/handoff/timeline panels populate. |
| v1.2.0-alpha.1 | [Read →](../../release-notes/v1.2.0-alpha.1.md) | [읽기 →](../../release-notes/ko/v1.2.0-alpha.1.md) | Desktop prerelease completed: fixes the Windows `.msi` build and adds signing docs, window-state persistence, light/dark toggle, and TUI-mirrored keyboard shortcuts. |
| v1.2.0-alpha.0 | [Read →](../../release-notes/v1.2.0-alpha.0.md) | [읽기 →](../../release-notes/ko/v1.2.0-alpha.0.md) | Desktop GUI prerelease: release job, deterministic icons, sidecar staging, read-only dashboard, and CLI JSON surface for desktop integration. |
| v1.1.3 | [Read →](../../release-notes/v1.1.3.md) | [읽기 →](../../release-notes/ko/v1.1.3.md) | Distributable release: per-OS standalone executables attached to GitHub Releases, automated release pipeline, README downloads, and Tauri desktop scaffold. |
| v1.0.0 | [Read →](../../release-notes/v1.0.0.md) | [읽기 →](../../release-notes/ko/v1.0.0.md) | Stable Local Release: frozen config/session contracts, .ai-session/ artifact validation (doctor --deep), full command reference (docs/COMMANDS.md EN+KO), finalized Agent Room set with read-only /diagnose. |
| v0.9.0 | [Read →](../../release-notes/v0.9.0.md) | [읽기 →](../../release-notes/ko/v0.9.0.md) | Automation & Runtime (bounded): LoopController, room /continue --max-steps N · /replan · /replay, relay-baton replay, adaptive per-agent compression thresholds. |
| v0.8.0 | [Read →](../../release-notes/v0.8.0.md) | [읽기 →](../../release-notes/ko/v0.8.0.md) | Adapter Expansion + Agent Room (first cut): OpenCode/Gemini/Aider adapter scaffolds, project-level fallback overrides, OS CI matrix, chat/room REPL. |
| v0.7.0 | [Read →](../../release-notes/v0.7.0.md) | [읽기 →](../../release-notes/ko/v0.7.0.md) | Review & Diagnose: review (deterministic diff-vs-plan), execution receipts, plan diffing, --json outputs, conversation event schema (draft). |
| v0.6.0 | [Read →](../../release-notes/v0.6.0.md) | [읽기 →](../../release-notes/ko/v0.6.0.md) | Trust & Verify: `relay-baton verify`(시뮬레이션 E2E, 모델 호출 없음), `doctor --deep`, TUI mode 패널, `docs/ROADMAP.md`. |
| v0.5.0 | [Read →](../../release-notes/v0.5.0.md) | [읽기 →](../../release-notes/ko/v0.5.0.md) | plan-execute 모드(`plan` / `execute`) + context 압축(`compress-context`). |
| v0.4.0 | [Read →](../../release-notes/v0.4.0.md) | [읽기 →](../../release-notes/ko/v0.4.0.md) | GitHub Actions CI, 테스트, session observability, `handoff history`. |
| v0.3.0 | [Read →](../../release-notes/v0.3.0.md) | [읽기 →](../../release-notes/ko/v0.3.0.md) | Side-effect 없는 `ProjectResolver`, 손상된 `projects.json` 자동 백업/recovery, `RELAY_BATON_PROJECTS_FILE` env override, fallback 시 `lastError` 정리. |
| v0.2.0 | [Read →](../../release-notes/v0.2.0.md) | [읽기 →](../../release-notes/ko/v0.2.0.md) | Project registry, `--project` / `--path`, project CLI, TUI dashboard 추가. |
| v0.1.0 | [Read →](../../release-notes/v0.1.0.md) | [읽기 →](../../release-notes/ko/v0.1.0.md) | Codex-to-Claude handoff MVP, token diet, fallback detection, quality gates. |

## License

MIT. 자세한 내용은 [`LICENSE`](../../LICENSE) 참조.

> 전체 문서(quality gate 세부, `.ai-session/` 파일 의미, config schema, TUI 키바인딩, 트러블슈팅 등)는 [English README](../../README.md)와 [`install/install.md`](../../install/install.md)에 있다.
