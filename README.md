<div align="center">

# ⚡ relay-baton

**Token-aware handoff harness for Codex CLI ↔ Claude Code**

Pass the baton from one coding agent to another — without spilling your token budget.

[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-%E2%89%A59-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](#-license)
[![Status](https://img.shields.io/badge/status-MVP-yellow.svg)](#-limitations-mvp)

**English**
 · [한국어](./docs/i18n/README.ko.md)
 · [日本語](./docs/i18n/README.ja.md)
 · [简体中文](./docs/i18n/README.zh-CN.md)
 · [繁體中文](./docs/i18n/README.zh-TW.md)
 · [Español](./docs/i18n/README.es.md)
 · [Français](./docs/i18n/README.fr.md)
 · [Deutsch](./docs/i18n/README.de.md)
 · [Português](./docs/i18n/README.pt-BR.md)
 · [Русский](./docs/i18n/README.ru.md)

</div>

---

> **The mission of this project**
>
> 💡 **Spend as few tokens as possible while merging Codex CLI and Claude Code CLI into a single workflow.**
>
> When one agent hits a quota / context limit, the next one resumes from the exact repository state — without re-pasting the whole log, diff, or repo. The handoff carries a *compact* summary and *file references* only. This is why relay-baton is a **token diet harness**: it's not a bonus feature, it's the reason this project exists.

`relay-baton` is a local harness that automates **Codex CLI ↔ Claude Code CLI** work handoff. When one agent runs into a usage / context / quota limit, the next agent resumes from the same repository state. Instead of dumping the entire log, diff, and repo, it passes a **compact handoff** plus **file references** — that's the token diet harness.

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

- 🪄 **Automatic fallback** — Detects phrases like `quota exceeded`, `rate limit exceeded`, `maximum context length` in Codex output and hands off to Claude Code automatically.
- 📉 **Token diet** — Five profiles (`off · lite · balanced · caveman · ultra`) with deterministic compaction: lock/build/minified files excluded, log tails, repo maps.
- 🛡️ **Auth-safe by default** — `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` are **blocked from child processes** by default. Explicit opt-in only.
- ✅ **Quality gates** — Handoff completeness and token budget are verified *before* the fallback agent is launched.
- 🧰 **One-shot login** — `relay-baton login` walks you through the Codex / Claude CLI auth flows interactively.
- 🎛️ **Ink TUI** — Session state, agent availability, and budget usage at a glance.
- 🚫 **No API calls of its own** — relay-baton never calls the OpenAI / Anthropic API directly. It only spawns the local CLIs.

## 🚀 Quick Start

```bash
# 1) Install & build
pnpm install
pnpm build

# 2) Log in to both CLIs in one go
pnpm relay-baton login

# 3) Sanity check
pnpm relay-baton doctor

# 4) Start a task on Codex; auto-handoff to Claude on quota/context limit
pnpm relay-baton run "Fix the mail attachment upload flow" --diet balanced
```

> `pnpm relay-baton` is an alias for `node packages/cli/dist/index.js`. For a global binary, link it with `pnpm -F @relay-baton/cli link --global` (optional).

## 🤖 One-line install via an agent

[`install/install.md`](./install/install.md) is both a human-readable install guide **and an instruction surface that coding agents (Codex, Claude Code) can follow as-is**. Paste it into an agent, or use one of the one-liners below.

**Codex CLI:**
```bash
codex exec --sandbox workspace-write "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and install relay-baton on this machine. Do not print or store API keys. Finish by running 'pnpm relay-baton doctor'."
```

**Claude Code (headless):**
```bash
claude --permission-mode acceptEdits -p "Read https://github.com/<your-org>/relay-baton/blob/main/install/install.md and follow it step by step to install relay-baton. Do not print or store API keys. End by running 'pnpm relay-baton doctor'."
```

If you'd rather install by hand, walk through Steps 1–6 in [`install/install.md`](./install/install.md).

## 📋 Requirements

| Item | Version / Note |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | required |
| [`codex`](https://github.com/openai/codex) | primary agent — **ChatGPT Plus or higher subscription required** |
| [`claude`](https://docs.claude.com/en/docs/agents-and-tools/claude-code/setup) | fallback agent — **Claude Pro or higher subscription required** |

> ### 💳 Subscription notice
>
> relay-baton **never calls the OpenAI / Anthropic API directly**. It uses the **subscription auth** of the local `codex` / `claude` CLIs.
>
> - **Codex CLI** — sign in with ChatGPT **Plus / Pro / Team / Enterprise**.
> - **Claude Code CLI** — sign in with Anthropic **Claude Pro / Max / Team / Enterprise**.
> - Free-tier accounts will not work reliably for either CLI.
> - API-key auth is technically possible but **blocked by default** behind `--allow-api-key-env`, to prevent accidental usage-based billing.

Default agent invocations:

- Codex: `codex exec --sandbox workspace-write "<task>"`
- Claude Code: `claude --permission-mode acceptEdits -p "<prompt>"`

`--full-auto`, `--ask-for-approval`, and `bypassPermissions` are intentionally **not** used (deprecated / unsupported / unsafe). Power users can override `agents.<id>.args` in `relay-baton.config.json`.

## 🔑 Logging in (Codex / Claude)

`relay-baton login` launches each CLI's native auth flow.

```bash
pnpm relay-baton login           # both
pnpm relay-baton login codex     # codex only
pnpm relay-baton login claude    # claude only
```

Under the hood:

- **Codex** → runs `codex login`. Complete the browser auth and you'll return automatically.
- **Claude** → opens an interactive `claude` session. Type `/login` at the prompt, complete the browser auth, then `/exit` (or Ctrl+C).

`claude --version` succeeding does **not** mean you're logged in. If you see "Not logged in", re-run the command above.

> relay-baton **does not store, print, or log API keys** during the auth process. All credentials are managed by each CLI itself.

## 🧭 Commands

| Command | Description |
|---|---|
| `relay-baton init` | Create `.ai-session/` in the current repo |
| `relay-baton doctor` | Check git / codex / claude / API key env / config |
| `relay-baton login [agent]` | Run Codex / Claude auth flows (`codex` / `claude` / `all`) |
| `relay-baton run "<task>"` | Run Codex, detect fallback, hand off to Claude |
| `relay-baton handoff --to claude` | Manual handoff (`--diet`, `--no-run`, `--force`) |
| `relay-baton compact` | Rebuild compact-state, repo-map, full-diff |
| `relay-baton squeeze` | Alias of `compact` |
| `relay-baton budget` | Show context budget usage |
| `relay-baton compress <file>` | Deterministically compress a markdown file (`--write`, `--out`) |
| `relay-baton status` | Print session status |
| `relay-baton tui` | Launch the Ink TUI (`q` quit, `r` refresh) |

## 🔄 Codex → Claude handoff flow

1. `relay-baton run "..."` spawns Codex CLI as a subprocess.
2. stdout/stderr are streamed live and appended to `.ai-session/commands.log`.
3. Output is scanned for fallback phrases (case-insensitive); grep-style result lines and documentation lines are skipped to avoid false positives.
4. On fallback, relay-baton collects git state, builds a repo map, compacts the state, and writes a handoff document.
5. **HandoffQualityGate + TokenDietQualityGate** are run *before* Claude Code is launched.
6. Claude Code resumes work from `.ai-session/handoff.md` and the referenced files.

## 📉 Token diet

Principles:

- Don't paste the whole thing.
- Prefer **log tail + known errors** over raw logs.
- Prefer **repo map** over full source.
- Prefer **focused diff** (lock / build / `*.min.js` excluded) over full diff.
- Delegate large content to file references.

### Diet profiles

| Profile | Intent | Notes |
|---|---|---|
| `off` | Minimal truncation | Mostly pass-through |
| `lite` | Light cleanup | Strip blank lines and duplicate instructions |
| `balanced` *(default)* | Day-to-day | Compact state + diff summary + log tail + repo map |
| `caveman` | Aggressive minimal | Short direct bullets; no full diff/log inline |
| `ultra` | Extreme | Almost everything via reference |

> `caveman` is **not a silly tone** — it means *aggressive minimal-context*. Technical accuracy is preserved.

relay-baton's aggressive token-diet profile takes inspiration from terse agent-output compression tools like *caveman*, but its focus is repository handoff, compact state, and cross-agent continuation.

## ⚙️ Configuration — `relay-baton.config.json`

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

If no config file exists, defaults are used.

## 📁 `.ai-session/` files

| File | Role |
|---|---|
| `task.md` | The user's task |
| `state.md` | Current state (Goal / Done / In Progress / Remaining / Decisions / Risks / Next Step) |
| `compact-state.md` | Deterministic compaction of `state.md` |
| `handoff.md` | Handoff document for the next agent |
| `decisions.md` | Decision log |
| `changed-files.md` | List of changed files |
| `repo-map.md` | Directory tree + key files |
| `commands.log` | Codex/Claude execution log (append-only) |
| `errors.md` | Error notes |
| `test-results.md` | Test / build results |
| `full-diff.patch` | `git diff HEAD` snapshot |
| `context-budget.json` | Token-diet usage snapshot |
| `session.json` | Session metadata |

## ✅ Quality gates

**Handoff Quality Gate** — runs before fallback launch
- Required files exist and are non-empty.
- `handoff.md` contains the sections `Goal`, `Previous Agent`, `Next Agent`, `Changed Files`, `Known Errors`, `Next Steps`.
- Fails the launch if anything is missing (use `--force` to override).

**Token Diet Quality Gate**
- `handoff.md` ≤ `maxHandoffChars` for the active profile.
- `Token Diet Summary` section present.
- Truncate marker present when content was actually truncated.
- `commands.log` / `AGENTS.md` / `CLAUDE.md` bodies must not be inlined.
- For `caveman` / `ultra`, the *Important Diff* block must stay within `maxDiffChars`.

## 🛡️ Auth & billing safety

- relay-baton **never stores, prints, or logs API keys**.
- `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are **stripped from child processes** by default.
- Only `--allow-api-key-env` or `authPolicy.allowApiKeyEnv: true` lets them through.
- `doctor` reports whether each variable is set — but **never** prints its value.

## 🧯 Safety

- Refuses to run `run` / `handoff` outside a git repo.
- Backs up an existing `handoff.md` with a timestamp suffix.
- `commands.log` is append-only.
- relay-baton **never modifies your source files directly** (only `.ai-session/`).
- `compress` does not overwrite the input file unless `--write` is passed.

## 🧪 Smoke test

After any change, run:

```bash
pnpm build
pnpm test
pnpm relay-baton doctor
pnpm relay-baton budget
```

## 🚧 Limitations (MVP)

- No LLM / tokenizer calls of its own — runs on **character budgets**.
- No semantic summarization — deterministic compaction only.
- Agent adapters: **Codex / Claude only**.
- TUI is read-only (`q` to quit, `r` to refresh).

## 🗺️ Roadmap

- OpenCode / Gemini / Aider adapters
- Per-model tokenizer option
- Semantic diff for compact state
- Multi-session management / TUI command palette
- Daemon / IDE extension (separate package)

## 🎯 Design principles

1. It's **work handoff**, not chat relay.
2. The **current repository state** beats any conversation history.
3. The handoff must be **readable by a human**.
4. Every UI is just a thin shell over `core`.
5. **Token diet is not a side feature — it's the core feature.**

## 🤝 Contributing

Issues and PRs are welcome. For larger changes, please open a short RFC issue first.

```bash
git clone https://github.com/<your-org>/relay-baton
cd relay-baton
pnpm install
pnpm build
pnpm test
```

## 📄 License

MIT. See [`LICENSE`](./LICENSE) for details.

---

<div align="center">

🌐 **Translations** ·
[한국어](./docs/i18n/README.ko.md) ·
[日本語](./docs/i18n/README.ja.md) ·
[简体中文](./docs/i18n/README.zh-CN.md) ·
[繁體中文](./docs/i18n/README.zh-TW.md) ·
[Español](./docs/i18n/README.es.md) ·
[Français](./docs/i18n/README.fr.md) ·
[Deutsch](./docs/i18n/README.de.md) ·
[Português](./docs/i18n/README.pt-BR.md) ·
[Русский](./docs/i18n/README.ru.md)

</div>
