<div align="center">

# ⚡ relay-baton

**Codex CLI ↔ Claude Code 토큰 인지형 인수인계 하네스**

토큰 예산을 흘리지 않고 한 코딩 에이전트에서 다음 에이전트로 바통을 넘긴다.

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

---

> **이 프로젝트의 핵심 미션**
>
> 💡 **토큰을 최소한으로 사용하면서 Codex CLI와 Claude Code CLI를 하나의 작업 흐름으로 병합한다.**
>
> 한 agent가 quota / context 한도에 부딪히면 다음 agent가 같은 repository 상태에서 그대로 이어받는다. 단, 전체 로그·diff·repo를 그대로 넘기는 대신 **compact handoff + 파일 참조**만 넘긴다. 이것이 relay-baton이 *token diet harness*인 이유이며, 부가 기능이 아니라 **존재 이유** 그 자체다.

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

## ✨ 기능

- 🪄 **자동 fallback**: Codex 출력에서 `quota exceeded`, `rate limit exceeded`, `maximum context length` 같은 phrase를 감지하면 자동으로 Claude Code로 인수인계.
- 📉 **Token diet**: 5단계 profile (`off · lite · balanced · caveman · ultra`) + 결정적 압축 (lock/build/min 파일 제외, log tail, repo map).
- 🛡️ **Auth-safe by default**: `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`는 child process에 **기본 전달 차단**. 명시적 opt-in 시에만 통과.
- ✅ **Quality Gates**: handoff 누락 섹션과 token 초과를 fallback 실행 전에 검증.
- 🧰 **One-shot login**: `relay-baton login`으로 Codex / Claude 로그인 흐름을 그대로 띄워준다.
- 🎛️ **Ink TUI**: 세션 상태·agent 가용성·budget을 한눈에.
- 🚫 **No API calls**: relay-baton 자체는 OpenAI / Anthropic API를 호출하지 않는다. 로컬 CLI subprocess만.

## 🚀 Quick Start

```bash
pnpm install
pnpm build
pnpm relay-baton login
pnpm relay-baton doctor
pnpm relay-baton run "메일 첨부파일 업로드 흐름을 고쳐줘" --diet balanced
```

## 📝 릴리즈 노트

| 버전 | English | 한국어 | 한 줄 요약 |
|---|---|---|---|
| v0.2.0 | [notes](../../release-notes/v0.2.0.md) | [릴리즈 노트](../../release-notes/ko/v0.2.0.md) | Project registry, `--project` / `--path`, project CLI, TUI dashboard 추가. |
| v0.1.0 | [notes](../../release-notes/v0.1.0.md) | [릴리즈 노트](../../release-notes/ko/v0.1.0.md) | Codex-to-Claude handoff MVP, token diet, fallback detection, quality gates. |

## 🧭 사용법

```bash
pnpm relay-baton init
pnpm relay-baton doctor
pnpm relay-baton run "작업 내용" --diet balanced
pnpm relay-baton handoff --to claude --no-run --diet caveman
```

Project를 등록해서 사용:

```bash
pnpm relay-baton project add /path/to/repo --name relay-baton --diet caveman --primary codex --fallback claude
pnpm relay-baton project switch relay-baton
pnpm relay-baton status --project relay-baton
pnpm relay-baton budget --project relay-baton
pnpm relay-baton tui --project relay-baton
```

## 🤖 Agent에게 한 줄로 설치 시키기

[`install/install.md`](../../install/install.md)는 **사람용 가이드이자, Codex / Claude Code 같은 coding agent가 그대로 따라 실행할 수 있는 instruction surface**다.

```bash
codex exec --sandbox workspace-write "https://github.com/<your-org>/relay-baton/blob/main/install/install.md 를 읽고 그대로 따라 설치해줘. API key는 출력/저장하지 마라. 끝나면 'pnpm relay-baton doctor' 결과를 보여줘."
```

```bash
claude --permission-mode acceptEdits -p "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and follow it step by step to install relay-baton. Do not print or store API keys. End by running 'pnpm relay-baton doctor'."
```

## 📋 요구사항

| 항목 | 버전 / 비고 |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | required |
| `codex` | **ChatGPT Plus 이상 구독 필요** |
| `claude` | **Claude Pro 이상 구독 필요** |

> ### 💳 구독 안내
>
> relay-baton은 OpenAI / Anthropic API를 직접 호출하지 않는다. 로컬 `codex` / `claude` CLI의 **구독 인증**을 그대로 사용한다.
>
> - Codex CLI → ChatGPT **Plus / Pro / Team / Enterprise**.
> - Claude Code CLI → Anthropic **Claude Pro / Max / Team / Enterprise**.
> - 무료 계정으로는 두 CLI 모두 정상 사용이 어렵다.
> - API key 인증은 가능하지만 **기본 차단** (`--allow-api-key-env` opt-in 필요).

## 🔑 로그인

```bash
pnpm relay-baton login           # 둘 다
pnpm relay-baton login codex
pnpm relay-baton login claude
```

`claude --version`이 통과해도 로그인은 별도다. "Not logged in"이 보이면 위 명령을 다시 실행하면 된다.

## 🧭 명령어

| 명령 | 설명 |
|---|---|
| `relay-baton init` | `.ai-session/` 생성 |
| `relay-baton doctor` | 환경 점검 |
| `relay-baton login [agent]` | Codex / Claude 로그인 |
| `relay-baton run "<task>"` | Codex 실행 + fallback 감지 + Claude로 이어받기 |
| `relay-baton handoff --to claude` | 수동 handoff |
| `relay-baton compact` | compact-state, repo-map, full-diff 재생성 |
| `relay-baton budget` | 현재 context budget 출력 |
| `relay-baton compress <file>` | markdown 결정적 압축 |
| `relay-baton status` | 세션 상태 |
| `relay-baton tui` | Ink TUI |

## 📉 Diet profiles

| Profile | 의도 |
|---|---|
| `off` | truncation 최소화 |
| `lite` | 가벼운 정리 |
| `balanced` *(기본)* | 일반 작업 |
| `caveman` | aggressive minimal-context |
| `ultra` | 극단 압축 |

> `caveman`은 장난스러운 말투가 아니라 **aggressive minimal-context profile**이다. 기술 정확도는 그대로 유지한다.

## 🛡️ 인증 / 과금 안전

- API key 저장 / 출력 / `.ai-session` 기록 **안 함**.
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`는 기본 차단.
- `--allow-api-key-env` 또는 `authPolicy.allowApiKeyEnv=true`만 통과.

## 🎯 설계 원칙

1. chat relay가 아니라 **work handoff**.
2. 대화 기록보다 **현재 repository 상태**가 우선.
3. handoff는 **사람이 읽어도** 이해 가능해야 한다.
4. 모든 UI는 core를 호출하는 껍데기다.
5. **Token diet는 부가 기능이 아니라 핵심 기능**이다.

## 📄 License

MIT. 자세한 내용은 [`LICENSE`](../../LICENSE) 참조.

> ℹ️ 전체 문서(설계 원칙, quality gate 세부, `.ai-session/` 파일 의미, 트러블슈팅 등)는 [English README](../../README.md)와 [`install/install.md`](../../install/install.md)에 있다.
