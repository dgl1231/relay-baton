# relay-baton 가이드

relay-baton 공개 문서의 단일 진입점: 설치, 빠른 시작, 데스크톱·CLI 워크플로,
프로젝트 관리, 아티팩트 모델, 안전 모델. 전체 명령 레퍼런스는
[COMMANDS.ko.md](./COMMANDS.ko.md), 영어 가이드는 [GUIDE.md](../GUIDE.md).

relay-baton은 로컬 handoff harness다: 채팅 로그·diff·repo를 다시 붙여넣지 않고
코딩 agent(Codex CLI ↔ Claude Code) 사이로 *최소 충분 상태*만 넘긴다. local-first,
subprocess-only, deterministic.

## 설치

가장 빠른 길 — 빌드 없이 단일 바이너리(실행에 Node 불필요):

```bash
# macOS / Linux (다운로드 → SHA256SUMS 검증 → 사용자 PATH에 설치)
curl -fsSL https://raw.githubusercontent.com/dgl1231/relay-baton/main/install/install.sh | sh
```

```powershell
# Windows PowerShell
iwr https://raw.githubusercontent.com/dgl1231/relay-baton/main/install/install.ps1 -UseB | iex
```

또는 [최신 릴리즈](https://github.com/dgl1231/relay-baton/releases/latest)에서
바이너리/데스크톱 인스톨러를 받는다. 소스 빌드·Codex/Claude CLI 설치·로그인까지의
단계별 안내는 [install/install.md](../../install/install.md)에 있다.

> relay-baton 자체는 OpenAI / Anthropic API를 호출하지 않는다. 로그인된 `codex` /
> `claude` CLI를 subprocess로 실행하며 그들의 subscription quota를 쓴다. 따라서 두
> CLI가 설치+로그인되어 있어야 한다.

## 빠른 시작

```bash
relay-baton doctor                 # git, codex, claude, env, config 점검
relay-baton init                   # 현재 repo에 .ai-session/ 생성
relay-baton run "불안정한 업로드 테스트 고쳐줘" --diet balanced
```

primary agent가 quota/context 한도에 닿으면 relay-baton이 감지해 repo의 실제
상태로 compact handoff를 만들고 fallback agent로 이어간다. 진행은
`relay-baton status`, `budget`, `replay`로 본다.

## CLI 워크플로

분류별 요약. 모든 옵션은 [COMMANDS.ko.md](./COMMANDS.ko.md) 참고.

- **세션**: `init`, `status`, `doctor [--deep]`, `verify`, `migrate`.
- **실행 & handoff**: `run`, `handoff [--to] [--no-run]`, `handoff show`,
  `handoff history`, `handoff bundle`, `handoff inspect`, `report`.
- **plan / execute**: `plan`, `execute`, `receipt`, `checkpoint`, `guard`,
  `risk`.
- **프로젝트 인텔리전스**: `workspace`, `profile`, `inventory`.
- **세션 아카이브**: `session archive` / `list` / `inspect` / `resume`.
- **프로젝트**: `project add` / `list` / `switch` / `current` / `remove`.
- **token diet**: `compact`, `compress-context`, `budget`.

대부분의 읽기 전용 명령은 스크립트용 `--json`을 지원한다.

## 데스크톱 워크플로

데스크톱 앱은 동일 CLI를 감싼 Tauri 셸이다(CLI 사이드카만 호출 — webview에
비즈니스 로직 없음). 읽기 전용 대시보드 + Agent Room을 제공한다:

- **대시보드**: status, budget, git, 세션 아카이브, guarded execution, project
  inspector, team handoff, updates.
- **Agent Room**: 대화 타임라인 + 슬래시 명령 팔레트(`/status`, `/git`,
  `/review`, `/sessions`, `/guard`, `/risk`, `/workspace`, `/bundle`, `/report`
  …). 읽기 전용 명령은 즉시 실행, agent 실행 명령은 preview/copy 우선.
- **i18n**: English / 한국어 / 日本語 / 简体中文, parity는 테스트로 강제.

변경을 일으키는 agent 동작은 GUI에서 실행되지 않는다 — 터미널에 복사할 수 있게
미리보기만 한다.

## 프로젝트 registry

여러 repo를 등록하고 활성 repo를 전환한다:

```bash
relay-baton project add /path/to/repo --diet caveman
relay-baton project switch repo
```

registry는 `~/.relay-baton/projects.json`. repo 결정 우선순위는 `--path` >
`--project` > active project > cwd. 등록된 project가 없어도 cwd 기준으로 동작한다.

## 아티팩트 & 스키마

세션 상태는 `.ai-session/` 아래에 있다(handoff, compact state, repo map, plan,
checkpoints, git baseline, session.json, conversation 로그 …). [ARTIFACTS.md](../ARTIFACTS.md)
참고. 버전드 아티팩트는 `schemaVersion`을 갖고, `relay-baton migrate --check`가
스키마 상태를 보고하며 `migrate --apply`가 legacy 아티팩트를 정규화한다(백업 동반).

## 안전 모델

- **LLM API 직접 호출 없음.** `codex` / `claude`를 subprocess로 구동하며 provider
  SDK를 포함하지 않는다(테스트로 강제).
- **API key 저장/출력 없음.** `--allow-api-key-env`가 없으면 `OPENAI_API_KEY` /
  `ANTHROPIC_API_KEY`는 child process로 전달되지 않는다.
- **자동 commit / push / PR 없음.** 변경을 일으키는 git 동작은 사람이 결정.
- **daemon 없음, 실시간 chat 플랫폼 없음, 기본 semantic/vector indexing 없음.**
  compaction과 project intelligence는 결정적.
- 중요한 곳은 **읽기 전용 또는 확인 우선**. 번들·마이그레이션은 쓰기 전에 백업하고
  `--dry-run`을 지원한다.

함께 보기: [RELEASE.md](../RELEASE.md)(배포 & 업데이트 채널),
[ROADMAP.md](../ROADMAP.md).
