<div align="center">

# ⚡ relay-baton

**Token-aware handoff harness for Codex CLI ↔ Claude Code**

Pass the baton from one coding agent to another — without spilling your token budget.

[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-%E2%89%A59-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](#license)
[![Status](https://img.shields.io/badge/status-MVP-yellow.svg)](#%EC%A0%9C%ED%95%9C%EC%82%AC%ED%95%AD-mvp)

</div>

---

> **이 프로젝트의 핵심 미션**
>
> 💡 **토큰을 최소한으로 사용하면서 Codex CLI와 Claude Code CLI를 하나의 작업 흐름으로 병합**한다.
>
> 한 agent의 quota / context 한도에 부딪히면 다음 agent가 같은 repository 상태에서 그대로 이어받는다. 단, 전체 로그·diff·repo를 그대로 넘기는 대신 **compact handoff + 파일 참조**만 넘긴다. 이것이 relay-baton이 *token diet harness*인 이유이며, 부가 기능이 아니라 **존재 이유** 그 자체다.

`relay-baton`은 **Codex CLI ↔ Claude Code CLI** 작업 인수인계를 자동화하는 로컬 하네스다. 한 agent가 usage / context / quota 한도를 만나면 다음 agent가 같은 repository 상태에서 그대로 이어받는다. 전체 로그·diff·repo를 그대로 붙여넣지 않고 **compact handoff** + **파일 참조** 형태로 넘기는 **token diet harness**이기도 하다.

```
┌─────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────┐
│ Codex   │ → │ Fallback     │ → │ Token Diet   │ → │ Claude │
│ exec    │   │ Detector     │   │ Handoff      │   │ Code   │
└─────────┘   └──────────────┘   └──────────────┘   └────────┘
                        ↓                ↓
                  .ai-session/handoff.md, compact-state.md,
                  repo-map.md, full-diff.patch, commands.log
```

## ✨ Features

- 🪄 **자동 fallback**: Codex 출력에서 `quota exceeded`, `rate limit exceeded`, `maximum context length` 같은 phrase를 감지하면 자동으로 Claude Code로 인수인계.
- 📉 **Token diet**: 5단계 profile (`off · lite · balanced · caveman · ultra`) + 결정적 압축 (lock/build/min 파일 제외, log tail, repo map).
- 🛡️ **Auth-safe by default**: `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`는 child process에 **기본 전달 차단**. 명시적 opt-in 시에만 통과.
- ✅ **Quality Gates**: handoff 누락 섹션과 token 초과를 fallback 실행 전에 검증.
- 🧰 **One-shot login**: `relay-baton login`으로 Codex / Claude 로그인 흐름을 그대로 띄워준다.
- 🎛️ **Ink TUI**: 세션 상태·agent 가용성·budget을 한눈에.
- 🚫 **No API calls**: relay-baton 자체는 OpenAI / Anthropic API를 호출하지 않는다. 로컬 CLI subprocess만.

## 🚀 Quick Start

```bash
# 1) 설치 & 빌드
pnpm install
pnpm build

# 2) 로컬 CLI 로그인 (Codex + Claude를 한 번에)
pnpm relay-baton login

# 3) 환경 점검
pnpm relay-baton doctor

# 4) 작업을 Codex로 시작 (한도 도달 시 자동으로 Claude로 넘김)
pnpm relay-baton run "메일 첨부파일 업로드 흐름을 고쳐줘" --diet balanced
```

> `pnpm relay-baton`은 `node packages/cli/dist/index.js`의 alias다. 전역 설치를 원하면 `pnpm -F @relay-baton/cli link --global` 같은 방식으로 별도 설정한다.

## 🤖 Agent에게 한 줄로 설치 시키기

[`install/install.md`](./install/install.md)는 **사람이 읽는 가이드이자, Codex CLI / Claude Code 같은 coding agent가 그대로 따라 실행할 수 있는 instruction surface**다. 복사해서 agent에게 붙여 넣어라.

**Codex CLI 한 줄:**
```bash
codex exec --sandbox workspace-write "https://github.com/<your-org>/relay-baton/blob/main/install/install.md 를 읽고 그대로 따라 설치해줘. API key는 출력/저장하지 마라. 끝나면 'pnpm relay-baton doctor' 결과를 보여줘."
```

**Claude Code 한 줄 (headless):**
```bash
claude --permission-mode acceptEdits -p "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and follow it step by step to install relay-baton on this machine. Do not print or store API keys. End by running 'pnpm relay-baton doctor'."
```

직접 손으로 설치하고 싶으면 [`install/install.md`](./install/install.md)의 Step 1~6을 차례로 따라가면 된다.

## 📋 요구사항

| 항목 | 버전 / 비고 |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | required |
| [`codex`](https://github.com/openai/codex) | primary agent — **ChatGPT Plus 이상 구독 필요** |
| [`claude`](https://docs.claude.com/en/docs/agents-and-tools/claude-code/setup) | fallback agent — **Claude Pro 이상 구독 필요** |

> ### 💳 구독 안내
>
> relay-baton은 OpenAI / Anthropic API를 **직접 호출하지 않는다**. 로컬 `codex` / `claude` CLI의 **구독(subscription) 인증을 그대로 사용**한다.
>
> - **Codex CLI** → ChatGPT **Plus / Pro / Team / Enterprise** 중 하나의 구독으로 로그인해야 한다.
> - **Claude Code CLI** → Anthropic **Claude Pro / Max / Team / Enterprise** 중 하나의 구독으로 로그인해야 한다.
> - 무료 계정으로는 두 CLI 모두 정상 사용이 어렵다.
> - API key 기반 사용은 가능하지만 **기본 차단**되어 있으며, `--allow-api-key-env` opt-in이 필요하다 (의도치 않은 usage 과금 방지).

기본 실행 인자:

- Codex: `codex exec --sandbox workspace-write "<task>"`
- Claude Code: `claude --permission-mode acceptEdits -p "<prompt>"`

`--full-auto`, `--ask-for-approval`, `bypassPermissions`는 사용하지 않는다 (deprecated/미지원/위험). 고급 사용자는 `relay-baton.config.json`의 `agents.<id>.args`로 직접 바꿀 수 있다.

## 🔑 로그인 (Codex / Claude)

`relay-baton login` 명령이 각 CLI의 인증 흐름을 그대로 띄운다.

```bash
pnpm relay-baton login           # Codex + Claude 둘 다
pnpm relay-baton login codex     # Codex만
pnpm relay-baton login claude    # Claude만
```

내부 동작:

- **Codex** → `codex login` 실행. 브라우저 인증을 마치면 자동 종료.
- **Claude** → 대화형 `claude` 세션을 띄움. 프롬프트에서 `/login` 입력 → 브라우저 인증 → `/exit` 또는 `Ctrl+C`로 빠져나옴.

`claude --version`이 성공해도 **로그인은 별도**다. "Not logged in" 메시지가 보이면 위 명령을 다시 실행하면 된다.

> relay-baton은 인증 과정에서 API key를 **저장하지도, 출력하지도, 기록하지도** 않는다. 모든 인증은 각 CLI가 자체 관리한다.

## 🧭 명령어

| 명령 | 설명 |
|---|---|
| `relay-baton init` | `.ai-session/` 생성 |
| `relay-baton doctor` | git / codex / claude / API key env / config 점검 |
| `relay-baton login [agent]` | Codex / Claude 로그인 흐름 실행 (`codex` / `claude` / `all`) |
| `relay-baton run "<task>"` | Codex 실행 → fallback 감지 → Claude로 이어받기 |
| `relay-baton handoff --to claude` | 수동 handoff (옵션: `--diet`, `--no-run`, `--force`) |
| `relay-baton compact` | compact-state, repo-map, full-diff 재생성 |
| `relay-baton squeeze` | `compact`의 alias |
| `relay-baton budget` | 현재 context budget 사용량 출력 |
| `relay-baton compress <file>` | markdown 결정적 압축 (`--write`, `--out`) |
| `relay-baton status` | 세션 상태 출력 |
| `relay-baton tui` | Ink 기반 TUI (`q` 종료, `r` refresh) |

## 🔄 Codex → Claude 인수인계 흐름

1. `relay-baton run "..."`이 Codex CLI를 subprocess로 띄운다.
2. stdout/stderr를 실시간 표시하면서 `.ai-session/commands.log`에 append.
3. fallback phrase를 case-insensitive로 감지 (grep 결과 / 문서 설명 라인은 제외).
4. fallback 시 git 상태 수집 → repo map → compact state → handoff 작성.
5. **HandoffQualityGate + TokenDietQualityGate** 통과 후 Claude Code 실행.
6. Claude Code는 `.ai-session/handoff.md`와 참조 파일을 기준으로 작업을 이어받는다.

## 📉 Token Diet

원칙:

- 전체를 붙여넣지 않는다.
- raw log 대신 **log tail + known errors**.
- full source 대신 **repo map**.
- 전체 diff 대신 **focused diff** (lock / build / `*.min.js` 제외).
- 큰 정보는 파일 참조로 위임.

### Diet Profiles

| Profile | 의도 | 특징 |
|---|---|---|
| `off` | truncation 최소화 | 거의 그대로 |
| `lite` | 가벼운 정리 | 빈 줄·중복 instruction 제거 |
| `balanced` *(기본)* | 일반 작업 | compact state + diff summary + log tail + repo map |
| `caveman` | aggressive minimal | 짧고 직접적인 bullet, full diff/log inline 금지 |
| `ultra` | 극단 압축 | 거의 모든 큰 정보를 reference로만 |

> `caveman`은 장난스러운 말투가 아니라 **aggressive minimal-context profile**이다. 기술 정확도는 그대로 유지한다.

relay-baton의 aggressive token diet profile은 caveman 같은 terse agent-output compression 도구에서 영감을 받았지만, relay-baton은 repository handoff, compact state, cross-agent continuation에 집중합니다.

## ⚙️ 설정 — `relay-baton.config.json`

```json
{
  "primaryAgent": "codex",
  "fallbackAgent": "claude",
  "agents": {
    "codex":  { "command": "codex",  "args": ["exec", "--sandbox", "workspace-write"] },
    "claude": { "command": "claude", "args": ["--permission-mode", "acceptEdits", "-p"] }
  },
  "fallbackPatterns": [
    "usage limit reached",
    "rate limit exceeded",
    "context length exceeded",
    "context limit exceeded",
    "token limit exceeded",
    "quota exceeded",
    "quota limit",
    "insufficient quota",
    "maximum context length",
    "too many requests"
  ],
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

## 📁 `.ai-session/` 파일

| 파일 | 역할 |
|---|---|
| `task.md` | 사용자 요청 작업 |
| `state.md` | 현재 상태 (Goal/Done/In Progress/Remaining/Decisions/Risks/Next Step) |
| `compact-state.md` | state.md 결정적 압축본 |
| `handoff.md` | 다음 agent용 인수인계 문서 |
| `decisions.md` | 결정 기록 |
| `changed-files.md` | 변경 파일 목록 |
| `repo-map.md` | 디렉터리 트리 + 키 파일 |
| `commands.log` | Codex/Claude 실행 로그 (append-only) |
| `errors.md` | 에러 메모 |
| `test-results.md` | 테스트/빌드 결과 |
| `full-diff.patch` | `git diff HEAD` snapshot |
| `context-budget.json` | diet 사용량 스냅샷 |
| `session.json` | 세션 메타 |

## ✅ Quality Gates

**Handoff Quality Gate** — handoff 실행 전 검증
- 필수 파일 존재 + 비어있지 않음
- `Goal`, `Previous Agent`, `Next Agent`, `Changed Files`, `Known Errors`, `Next Steps` 섹션 존재
- 통과 못하면 fallback agent 실행 차단 (`--force`로 우회 가능)

**Token Diet Quality Gate**
- `handoff.md` ≤ `maxHandoffChars`
- `Token Diet Summary` 섹션 존재
- truncate marker 포함 여부 확인
- `commands.log` / `AGENTS.md` / `CLAUDE.md` 본문 inline 금지
- `caveman` / `ultra` profile에서 Important Diff 블록 크기 제한

## 🛡️ Auth & Billing Safety

- relay-baton은 API key를 **저장 / 출력 / `.ai-session` 기록 안 함**.
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`는 기본적으로 child process에 **전달되지 않는다**.
- `--allow-api-key-env` 또는 `authPolicy.allowApiKeyEnv: true`인 경우에만 통과.
- `doctor`는 key 값을 출력하지 않고 set 여부만 알린다.

## 🧯 Safety

- git repo가 아니면 `run` / `handoff` 중단.
- 기존 `handoff.md`는 timestamp suffix로 자동 backup.
- `commands.log`는 append-only.
- relay-baton은 **사용자 소스 파일을 직접 수정하지 않는다** (`.ai-session/`만 직접 수정).
- `compress` 명령은 `--write` 없이는 원본을 덮어쓰지 않는다.

## 🧪 Smoke test

변경 후 최소 회귀 확인:

```bash
pnpm build
pnpm test
pnpm relay-baton doctor
pnpm relay-baton budget
```

## 🚧 제한사항 (MVP)

- LLM / tokenizer 직접 호출 없음. **character budget** 기반 동작.
- semantic summarization 없음. deterministic compaction만.
- agent adapter는 **Codex / Claude**만.
- TUI는 read-only (`q` 종료, `r` refresh).

## 🗺️ Roadmap

- OpenCode / Gemini / Aider adapter
- model별 tokenizer 옵션
- compact state semantic diff
- session 다중 관리 / TUI command palette
- daemon / IDE extension (별도 패키지)

## 🎯 Design Principles

1. chat relay가 아니라 **work handoff**다.
2. 대화 기록보다 **현재 repository 상태**가 우선이다.
3. handoff는 **사람이 읽어도** 이해 가능해야 한다.
4. 모든 UI는 core를 호출하는 껍데기다.
5. **token diet는 부가 기능이 아니라 핵심 기능**이다.

## 🤝 Contributing

이슈와 PR을 환영한다. 큰 변경 전에는 짧은 RFC 이슈를 먼저 열어주세요.

```bash
git clone https://github.com/<your-org>/relay-baton
cd relay-baton
pnpm install
pnpm build
pnpm test
```

## 📄 License

MIT. 자세한 내용은 [`LICENSE`](./LICENSE)를 참조.
