<div align="center">

# relay-baton

**Portable continuation infrastructure for coding agents.**

Pass compressed coding state between Codex CLI, Claude Code, and whatever ships next — without re-pasting the chat log, the diff, or the repo.

[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-%E2%89%A59-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](#license)
[![Latest](https://img.shields.io/badge/release-v2.0.0--alpha.6-blue.svg)](./release-notes/v2.0.0-alpha.6.md)
[![Download](https://img.shields.io/badge/download-binaries-238636.svg)](https://github.com/dgl1231/relay-baton/releases/latest)

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

```bash
# Codex hits a quota wall mid-task. relay-baton notices, builds a compact
# handoff from the repository's actual state, and resumes the work in Claude.
$ relay-baton run "refactor the upload pipeline" --diet caveman
[relay-baton] codex: ... rate limit exceeded ...
[relay-baton] fallback pattern detected: rate limit exceeded
[relay-baton] building handoff for claude...
[relay-baton] claude resumed from .ai-session/handoff.md
```

---

## Download

Prebuilt, single-file executables are attached to every release — no Node install required to run them.

One-line CLI install (verifies `SHA256SUMS`, no admin required):

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/dgl1231/relay-baton/main/install/install.sh | sh
```

```powershell
# Windows PowerShell
iwr https://raw.githubusercontent.com/dgl1231/relay-baton/main/install/install.ps1 -UseB | iex
```

| OS | Binary | Get it |
| --- | --- | --- |
| macOS (Apple Silicon) | `relay-baton-macos-arm64` | [Latest release](https://github.com/dgl1231/relay-baton/releases/latest) |
| Linux (x64) | `relay-baton-linux-x64` | [Latest release](https://github.com/dgl1231/relay-baton/releases/latest) |
| Windows (x64) | `relay-baton-windows-x64.exe` | [Latest release](https://github.com/dgl1231/relay-baton/releases/latest) |

```bash
# macOS / Linux
chmod +x relay-baton-macos-arm64
./relay-baton-macos-arm64 --version
```

```powershell
# Windows
.\relay-baton-windows-x64.exe --version
```

**Desktop app** (Tauri shell over the same CLI — see [`desktop/`](./desktop)):

| OS | Installer | Get it |
| --- | --- | --- |
| macOS (Apple Silicon) | `relay-baton_…_aarch64.dmg` | [Latest release](https://github.com/dgl1231/relay-baton/releases/latest) |
| Linux (x64) | `relay-baton_…_amd64.AppImage` | [Latest release](https://github.com/dgl1231/relay-baton/releases/latest) |
| Windows (x64) | `relay-baton_…_x64_en-US.msi` | [Latest release](https://github.com/dgl1231/relay-baton/releases/latest) |

> Desktop installers are signed/notarized only when release signing secrets are
> configured. Unsigned fallback builds still ship, so expect Gatekeeper /
> SmartScreen prompts on unsigned releases. `SHA256SUMS` is attached to new
> releases for CLI installer verification.
> Desktop update checks are opt-in and manual. Signed updater artifacts and
> `latest.json` are published only when Tauri updater signing secrets are
> configured for a release.
>
> Older versions: pick any tag on the [releases page](https://github.com/dgl1231/relay-baton/releases). Prefer to build from source instead? See [Install](#install) below.

## Why this exists

AI coding work is fragmenting across tools. A real session looks like this:

- Codex CLI for one batch of edits.
- Claude Code for another.
- A laptop in the morning, a different machine in the evening.
- A context window that fills up, falls over, or quietly truncates.

The default way to move work between agents today is **copy-paste the chat log** — or worse, the whole repo dumped into a prompt. That approach has three problems:

1. **Tokens.** Chat logs are mostly noise. You pay for that noise every turn.
2. **Continuity.** The next agent doesn't get *intent*; it gets transcripts.
3. **Fragility.** One missed file, one stale diff, and the agent restarts from a wrong premise.

relay-baton is a **local harness** that sits underneath the agents and carries the *minimum sufficient state* across the handoff: a compact summary, a repo map, and file references — not a transcript.

> **Spend as few tokens as possible while merging Codex CLI and Claude Code CLI into a single workflow.**
>
> When one agent hits a quota / context limit, the next one resumes from the exact repository state — without re-pasting the whole log, diff, or repo.

## The idea

```
┌─────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────┐
│ Codex   │ → │ Fallback     │ → │ Token Diet   │ → │ Claude │
│ exec    │   │ Detector     │   │ Handoff      │   │ Code   │
└─────────┘   └──────────────┘   └──────────────┘   └────────┘
                        ↓                ↓
                  .ai-session/handoff.md, compact-state.md,
                  repo-map.md, full-diff.patch, commands.log
```

A baton-pass for coding agents:

- **Detect** when the current agent stops being useful (quota, context, rate, errors).
- **Capture** what matters — repo state, changed files, decisions, next step.
- **Compact** it under a budget the next agent can actually consume.
- **Hand off** with quality gates so the receiver isn't fed broken context.

The handoff is a small file (`.ai-session/handoff.md`) plus references. Everything heavy — the full diff, the full log, the full repo map — stays on disk and is loaded on demand.

## Workflow

```bash
$ relay-baton init                  # create .ai-session/ in the current repo
$ relay-baton doctor                # check git, codex, claude, env, config

$ relay-baton run "fix flaky upload test" --diet balanced
[relay-baton] running codex exec --sandbox workspace-write "fix flaky upload test"
... codex output streams here ...
[relay-baton] fallback pattern detected: maximum context length
[relay-baton] building handoff for claude...
[relay-baton] HandoffQualityGate: ok
[relay-baton] TokenDietQualityGate: ok
[relay-baton] running claude --permission-mode acceptEdits -p "<continuation>"
... claude resumes, edits files, finishes ...

$ relay-baton status                # what state is the session in?
$ relay-baton budget                # how much of the diet budget did we use?
```

Manual handoff, no auto-fallback:

```bash
$ relay-baton handoff --to claude --no-run --diet caveman
```

Across multiple repos:

```bash
$ relay-baton project add /path/to/repo-a --diet caveman
$ relay-baton project add /path/to/repo-b --diet balanced
$ relay-baton project switch repo-b
$ relay-baton run "wire up the new metrics endpoint"
```

### Plan-execute mode

A proactive alternative to reactive fallback: have a planner write a structured
plan, gate it for completeness, then have an executor implement it.

```bash
# 1) Planner (default: Claude) writes .ai-session/plan.md, gated by PlanQualityGate.
$ relay-baton plan "add rate limiting to the upload endpoint" --with claude

# 2) Inspect / edit the plan if you want.
$ cat .ai-session/plan.md

# 3) Executor (default: Codex) implements the plan.
$ relay-baton execute --with codex

# Or do both in one shot once the plan passes its gate:
$ relay-baton plan "add rate limiting" --then-execute

# Scaffold an empty plan template without launching an agent:
$ relay-baton plan "explore options" --no-run
```

### Context-compression mode

Deterministic mid-session compaction of `state.md` / `commands.log` so an agent
runs longer before hitting a context wall. No model call, fully reversible
(raw artifacts are rotated to `commands.log.full.<ts>`).

```bash
# See what would change without writing anything.
$ relay-baton compress-context --dry-run

# Compress when weight/budget exceeds the threshold (default 0.8).
$ relay-baton compress-context --threshold 0.8

# Force compression regardless of threshold.
$ relay-baton compress-context --force
```

### Verify the harness (no model calls)

```bash
# Simulated end-to-end check: resolution, fallback detection, handoff no-run,
# token budget, API-key env block. Exits non-zero on failure.
$ relay-baton verify

# Extended environment diagnostics (OK/WARN/FAIL checklist).
$ relay-baton doctor --deep
```

Neither `verify` nor `doctor --deep` makes any network or model call, and
`verify` writes nothing into your repo (it uses a throwaway temp dir).

## Quick start

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

### One-line install via an agent

[`install/install.md`](./install/install.md) is both a human install guide **and an instruction surface that coding agents can execute as-is**:

```bash
# Codex CLI
codex exec --sandbox workspace-write "Read https://github.com/dgl1231/relay-baton/blob/main/install/install.md and install relay-baton on this machine. Do not print or store API keys. Finish by running 'pnpm relay-baton doctor'."

# Claude Code (headless)
claude --permission-mode acceptEdits -p "Read https://github.com/dgl1231/relay-baton/blob/main/install/install.md and follow it step by step. Do not print or store API keys. End by running 'pnpm relay-baton doctor'."
```

## Features

- **Automatic fallback.** Detects `quota exceeded`, `rate limit exceeded`, `maximum context length` and similar in agent output and hands off to the fallback agent. False-positive guards skip grep results and prose about the patterns themselves.
- **Token diet.** Five deterministic compaction profiles (`off · lite · balanced · caveman · ultra`). Lock files, build output, minified bundles, and binary blobs are excluded; logs are tailed; repo maps replace source.
- **Plan-execute mode.** A proactive alternative to reactive fallback: a planner agent (default Claude) writes a structured `.ai-session/plan.md`, gated for completeness, then an executor agent (default Codex) implements it. `relay-baton plan "<task>" --then-execute`.
- **Context compression.** Proactive, deterministic mid-session compression of `state.md` / `commands.log` so an agent runs longer before hitting a context wall. `relay-baton compress-context`, plus an auto-pass inside `run`.
- **Quality gates.** A handoff is *verified* before the fallback agent is launched — required sections present, budget respected, no inlined manifests.
- **Auth-safe by default.** `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` are stripped from child processes. Opt-in only via `--allow-api-key-env`. No keys are ever stored, printed, or logged.
- **Project registry.** Register multiple repos once, switch the active project, run commands against any of them with `--project` or `--path`.
- **Ink TUI.** Project / session dashboard with diet cycling, budget refresh, and no-run handoff generation. Never launches agents.
- **No API of its own.** relay-baton never calls the OpenAI / Anthropic API directly. It only spawns the local `codex` / `claude` CLIs as subprocesses.

## Architecture

```
packages/
  shared/    # types, constants
  core/      # UI-independent business logic
    agents/        # AgentAdapter, CodexAdapter, ClaudeCodeAdapter, FallbackDetector
    git/           # GitService, RepoMapGenerator
    session/       # SessionManager (.ai-session/ lifecycle)
    token-diet/    # BudgetManager, DiffCompactor, LogCompactor, HandoffCompactor, ...
    handoff/       # HandoffGenerator, HandoffQualityGate, TokenDietQualityGate, PromptBuilder
    workflow/      # BatonWorkflow — the orchestration
    projects/      # ProjectRegistry, ProjectManager, ProjectResolver
  cli/       # commander entrypoints — thin shells over core
  tui/       # Ink dashboard — read-only over core
```

Design rules:

- `core` knows nothing about UI.
- `cli` and `tui` hold no business logic — they wire user input to `core`.
- Each agent is an `AgentAdapter`. Adding `opencode`, `gemini`, `aider` means adding an adapter, not patching `core`.
- Everything written to disk lives under `.ai-session/`. relay-baton never edits your source files.

## Usage

Single-repository flow:

```bash
relay-baton init
relay-baton doctor
relay-baton run "Fix the failing upload flow" --diet balanced
relay-baton status
relay-baton budget
```

Generate a handoff without launching the next agent:

```bash
relay-baton handoff --to claude --no-run --diet caveman
```

Register and use a project:

```bash
relay-baton project add /path/to/relay-baton --name relay-baton --diet caveman --primary codex --fallback claude
relay-baton project list
relay-baton project switch relay-baton
relay-baton status --project relay-baton
relay-baton handoff --to claude --no-run --project relay-baton --diet caveman
```

Direct path without registering:

```bash
relay-baton status --path /path/to/repo
relay-baton budget --path /path/to/repo
```

Open the TUI dashboard:

```bash
relay-baton tui --project relay-baton
```

## Commands

| Command | Description |
|---|---|
| `relay-baton init` | Create `.ai-session/` in the current repo |
| `relay-baton doctor` | Check git / codex / claude / env / config (`--deep` for extended diagnostics) |
| `relay-baton verify` | Simulated end-to-end check — no real model calls (`--diet`, `--verbose`, `--keep-temp`) |
| `relay-baton login [agent]` | Run Codex / Claude auth flows (`codex` / `claude` / `all`) |
| `relay-baton run "<task>"` | Run primary agent, detect fallback, hand off |
| `relay-baton handoff --to claude` | Manual handoff (`--diet`, `--no-run`, `--force`) |
| `relay-baton handoff history` | List the current + backed-up handoff documents (metadata only) |
| `relay-baton plan "<task>"` | Plan-execute mode: planner writes `plan.md` (`--with`, `--no-run`, `--then-execute`) |
| `relay-baton execute` | Plan-execute mode: executor implements `plan.md` (`--with`, `--from`) |
| `relay-baton review` | Deterministically review the diff against `plan.md` Steps — no model call (`--json`) |
| `relay-baton receipt done/skip/list` | Append-only execution receipts for plan steps (`--note`, `--json`) |
| `relay-baton compact` / `squeeze` | Rebuild compact-state, repo-map, full-diff |
| `relay-baton compress-context` | Compress running state.md / commands.log when over budget (`--dry-run`, `--threshold`) |
| `relay-baton budget` | Show context-budget usage |
| `relay-baton compress <file>` | Deterministically compress a markdown file |
| `relay-baton status` | Print session status |
| `relay-baton project add <path>` | Register a project directory |
| `relay-baton project list` / `current` / `doctor` | Inspect registered projects |
| `relay-baton project switch <name-or-id>` | Change the active project |
| `relay-baton project remove <name-or-id>` | Unregister a project |
| `relay-baton tui` | Launch the Ink dashboard (display-only; never spawns agents) |
| `relay-baton chat` / `room` | Agent Room: turn-based, confirmation-first multi-agent REPL (v0.9: `/continue --max-steps N`, `/replan`, `/replay`) |
| `relay-baton replay` | Replay the recorded conversation timeline — read-only, no model call (`--json`, `--session`, `--kind`, `--limit`) |

Project-aware commands accept `--project <name-or-id>` and `--path <repoPath>`.

Resolution priority: `--path` > `--project` > active project > current working directory. `compress <file>` stays cwd-based — it's a file-level utility.

## Project registry

Projects are stored at `~/.relay-baton/projects.json`. Set `RELAY_BATON_PROJECTS_FILE` to use a different path (CI, sandboxing, tests).

```bash
relay-baton project add /path/to/relay-baton --name relay-baton --diet caveman --primary codex --fallback claude
relay-baton project list
relay-baton project switch relay-baton
```

`project add` requires the path to exist and be a directory. It may be a plain, non-git project folder; git-backed commands such as `run` and `handoff` still require a git repository when executed. Duplicate paths are not added twice. A corrupt `projects.json` is backed up to `projects.json.corrupt-<timestamp>.bak` and reset to an empty registry — commands keep working. Read-only commands (`status`, `budget`, `doctor`) do not write the registry; only `run` and `handoff` update `lastUsedAt`.

## Handoff flow

1. `relay-baton run "..."` spawns the primary CLI as a subprocess.
2. stdout / stderr stream live and append to `.ai-session/commands.log`.
3. Output is scanned for fallback phrases. Grep-style result lines and prose explaining the patterns are skipped to avoid false positives.
4. On fallback, relay-baton collects git state, builds a repo map, compacts the state, and writes the handoff document.
5. **HandoffQualityGate + TokenDietQualityGate** run *before* the fallback agent launches.
6. The fallback agent resumes from `.ai-session/handoff.md` and the referenced files.

## Token diet

Principles:

- Don't paste the whole thing.
- Prefer **log tail + known errors** over raw logs.
- Prefer **repo map** over full source.
- Prefer **focused diff** (lock / build / `*.min.js` excluded) over full diff.
- Delegate large content to file references.

### Profiles

| Profile | Intent | Notes |
|---|---|---|
| `off` | Minimal truncation | Mostly pass-through |
| `lite` | Light cleanup | Strip blank lines, duplicate instructions |
| `balanced` *(default)* | Day-to-day | Compact state + diff summary + log tail + repo map |
| `caveman` | Aggressive minimal | Short direct bullets; no full diff/log inline |
| `ultra` | Extreme | Almost everything via reference |

> `caveman` is **not a silly tone** — it means *aggressive minimal-context*. Technical accuracy is preserved.

## `.ai-session/` files

| File | Role |
|---|---|
| `task.md` | The user's task |
| `state.md` | Current state (Goal / Done / In Progress / Remaining / Decisions / Risks / Next Step) |
| `compact-state.md` | Deterministic compaction of `state.md` |
| `handoff.md` | Handoff document for the next agent |
| `decisions.md` | Decision log |
| `changed-files.md` | List of changed files |
| `repo-map.md` | Directory tree + key files |
| `commands.log` | Codex / Claude execution log (append-only) |
| `errors.md` | Error notes |
| `test-results.md` | Test / build results |
| `full-diff.patch` | `git diff HEAD` snapshot |
| `context-budget.json` | Token-diet usage snapshot |
| `session.json` | Session metadata |

## Configuration — `relay-baton.config.json`

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

## TUI

`relay-baton tui` opens an Ink dashboard for the active project, or `relay-baton tui --project <name-or-id>` for a specific one.

- Sidebar: active project, registered projects, selected diet, primary / fallback agents, key hints.
- Main panels: task, session status, active agent, fallback reason, repo path, changed files, compact-state preview, token budget, log tail, recent errors.
- Keys: `q` quit · `r` refresh · `p` next project · `d` cycle diet (in memory) · `b` reload budget · `h` generate handoff with no agent run.

The TUI never launches Codex or Claude. It reads session files and can generate a no-run handoff.

## Quality gates

**Handoff Quality Gate** — runs before fallback launch:

- Required files exist and are non-empty.
- `handoff.md` contains the sections `Goal`, `Previous Agent`, `Next Agent`, `Changed Files`, `Known Errors`, `Next Steps`.
- Fails the launch if anything is missing. `--force` overrides.

**Token Diet Quality Gate**:

- `handoff.md` ≤ `maxHandoffChars` for the active profile.
- `Token Diet Summary` section present.
- Truncate marker present when content was actually truncated.
- `commands.log` / `AGENTS.md` / `CLAUDE.md` bodies must not be inlined.
- For `caveman` / `ultra`, the *Important Diff* block stays within `maxDiffChars`.

## Auth & safety

- Never stores, prints, or logs API keys.
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` stripped from child processes by default.
- Only `--allow-api-key-env` or `authPolicy.allowApiKeyEnv: true` lets them through.
- `doctor` reports whether each variable is set — but never prints its value.
- Refuses to run `run` / `handoff` outside a git repo.
- Backs up an existing `handoff.md` with a timestamp suffix.
- `commands.log` is append-only.
- relay-baton never modifies your source files directly — only `.ai-session/`.
- `compress` does not overwrite the input file unless `--write` is passed.

## vs the alternatives

| Approach | What carries over | Token cost | Continuity | Failure mode |
|---|---|---|---|---|
| Raw chat export | Entire transcript | High (most of it is noise) | Brittle — agent re-reads its own thinking | Context window overflow |
| Copy-paste prompting | What the human remembered | Variable | Fragile — depends on memory | Silent drift from real state |
| Whole-repo dump | Everything | Very high | Strong but expensive | Truncated mid-file by the model |
| **relay-baton** | Compact summary + repo map + file references | **Low, bounded by profile** | Strong — driven by *actual* repo state | Fails *loudly* via quality gates |

## Philosophy

relay-baton is **small sharp tooling for AI-native development workflows**.

- **Local-first.** Everything lives on your disk. No cloud, no daemon, no telemetry, no account.
- **Composability.** A `.ai-session/` directory is just files. Read them, grep them, diff them, ship them in a PR.
- **Lightweight state transfer.** A handoff is a markdown file, not a database.
- **Deterministic over clever.** No LLM-driven summarization in the harness itself — if the model gets summarization wrong, the handoff lies. relay-baton uses character budgets, structural rules, and explicit references.
- **Repo state is the source of truth.** The conversation is interpretation; the repo is fact.
- **Token efficiency is the feature**, not a knob hidden in a menu. Every design decision is measured against "does this bloat the handoff?"

### Design principles

1. It's **work handoff**, not chat relay.
2. The **current repository state** beats any conversation history.
3. The handoff must be **readable by a human**.
4. Every UI is just a thin shell over `core`.
5. **Token diet is not a side feature — it's the core feature.**

## Demo

> _GIF / asciinema recording placeholder — coming with v0.4._
>
> A 30-second clip will show a Codex run hitting a quota wall, relay-baton emitting a compact handoff, and Claude Code resuming the task from the exact same repo state.

## Requirements

| Item | Version / Note |
|---|---|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| git | required |
| [`codex`](https://github.com/openai/codex) | primary agent — **ChatGPT Plus or higher subscription required** |
| [`claude`](https://docs.claude.com/en/docs/agents-and-tools/claude-code/setup) | fallback agent — **Claude Pro or higher subscription required** |

> ### Subscription notice
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

## Logging in

`relay-baton login` launches each CLI's native auth flow.

```bash
relay-baton login           # both
relay-baton login codex     # codex only
relay-baton login claude    # claude only
```

Under the hood:

- **Codex** → runs `codex login`. Complete browser auth and you return automatically.
- **Claude** → opens an interactive `claude` session. Type `/login`, complete browser auth, then `/exit`.

`claude --version` succeeding does **not** mean you're logged in. If you see "Not logged in", re-run the command above.

> relay-baton does not store, print, or log credentials during the auth process. All credentials are managed by each CLI itself.

## Limitations (MVP)

- No LLM / tokenizer calls of its own — runs on **character budgets**.
- No semantic summarization — deterministic compaction only.
- Agent adapters: **Codex / Claude only**.
- TUI does not run agents; v0.2+ allows no-run handoff generation only.

## Future direction

relay-baton starts as a two-agent fallback harness. The same primitive scales further:

- **Multi-agent relay chains.** Codex → Claude → OpenCode → back to Codex, each leg carrying a compact handoff.
- **Branching session trees.** Fork a task into parallel agent attempts; reconcile via diffs.
- **Remote relay state.** Push `.ai-session/` to a shared remote so the next machine picks up where the last one stopped.
- **Orchestrated workflows.** `review`, `diagnose`, `continue` modes — bounded autopilot loops with explicit checkpoints.
- **More adapters.** OpenCode, Gemini CLI, Aider, anything else with a sane local subprocess interface.

The harness stays the same shape: detect, capture, compact, hand off.

### Roadmap

The full roadmap lives in [`docs/ROADMAP.md`](./docs/ROADMAP.md):

- **v0.6 — Trust & Verify**: `verify`, `doctor --deep`, TUI mode panel.
- **v0.7 — Review & Diagnose**: `review`, plan execution receipts, plan diffing, `--json` outputs, conversation event schema.
- **v0.8 — Adapter Expansion + Agent Room (first cut)**: OpenCode / Gemini / Aider adapter scaffolds, project-level fallback overrides, OS CI matrix, and `relay-baton chat`/`room` (turn-based, confirmation-first REPL).
- **v0.9 — Automation & Runtime** (current): bounded multi-turn loop (`LoopController`), `/continue --max-steps N`, `/replan`, session `replay`, adaptive per-agent compression thresholds.
- **v1.0 — Stable Local Release**: frozen schema, full command reference, i18n parity.

### Future: Agent Room / Conversation Mode

A planned direction (first cut in v0.8) to turn relay-baton into an interactive
**multi-agent workspace**: talk to Claude and Codex by turns in one session,
with per-agent messages clearly distinguished — Claude as planner/reviewer,
Codex as executor. It keeps every existing safety rail (subprocess-only, no API
keys, no auto commit/push/PR, confirmation-first with a prompt preview before
any real run). Design only for now — **not implemented yet**. Full design:
[`docs/AGENT_ROOM.md`](./docs/AGENT_ROOM.md).

## Documentation

- [`docs/GUIDE.md`](./docs/GUIDE.md) — consolidated guide: install, quickstart, desktop/CLI workflows, safety ([한국어](./docs/i18n/GUIDE.ko.md))
- [`docs/COMMANDS.md`](./docs/COMMANDS.md) — full command reference ([한국어](./docs/i18n/COMMANDS.ko.md))
- [`docs/ARTIFACTS.md`](./docs/ARTIFACTS.md) — `.ai-session/` artifact stability contract (v1.0)
- [`docs/AGENT_ROOM.md`](./docs/AGENT_ROOM.md) — Agent Room design
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — roadmap
- [`docs/RELEASE.md`](./docs/RELEASE.md) — release & distribution runbook (how the per-OS binaries are built/shipped)
- [`docs/HANDOFF.md`](./docs/HANDOFF.md) — session handoff / current state (start here in a new session)

## Release notes

Detailed notes live in [`release-notes/`](./release-notes/) ([index](./release-notes/README.md)). They are user-facing changelogs, not agent handoff material — that role belongs to `.ai-session/handoff.md`.

**Latest:** v2.0.0-alpha.6 — [English](./release-notes/v2.0.0-alpha.6.md) · [한국어](./release-notes/ko/v2.0.0-alpha.6.md)

| Version | English | 한국어 | One-line summary |
|---|---|---|---|
| v2.0.0-alpha.6 | [Read →](./release-notes/v2.0.0-alpha.6.md) | [읽기 →](./release-notes/ko/v2.0.0-alpha.6.md) | Conversation-event schema versioning + `session export`; v2.0 feature-complete and a "Beyond v2.0" roadmap. |
| v2.0.0-alpha.5 | [Read →](./release-notes/v2.0.0-alpha.5.md) | [읽기 →](./release-notes/ko/v2.0.0-alpha.5.md) | Session archive prune policy (`session prune`, disabled by default, dry-run unless `--apply`) + a CI release-creation race fix. |
| v2.0.0-alpha.4 | [Read →](./release-notes/v2.0.0-alpha.4.md) | [읽기 →](./release-notes/ko/v2.0.0-alpha.4.md) | git-baseline.json brought under the versioned schema contract (registry + migrate/doctor coverage + legacy normalization). |
| v2.0.0-alpha.3 | [Read →](./release-notes/v2.0.0-alpha.3.md) | [읽기 →](./release-notes/ko/v2.0.0-alpha.3.md) | Installer/update finalized + public docs pass: a locked distribution policy in RELEASE.md and a consolidated `docs/GUIDE.md` (EN+KO). |
| v2.0.0-alpha.2 | [Read →](./release-notes/v2.0.0-alpha.2.md) | [읽기 →](./release-notes/ko/v2.0.0-alpha.2.md) | Stability guards: desktop i18n parity test (en/ko/ja/zh) enforcing the stable desktop contract, and a hard-constraints test locking the auth policy + no-LLM-client rule. |
| v2.0.0-alpha.1 | [Read →](./release-notes/v2.0.0-alpha.1.md) | [읽기 →](./release-notes/ko/v2.0.0-alpha.1.md) | Schema migrator apply path: `relay-baton migrate --apply [--dry-run]` normalizes legacy artifacts with timestamped backups, opt-in and idempotent. |
| v2.0.0-alpha.0 | [Read →](./release-notes/v2.0.0-alpha.0.md) | [읽기 →](./release-notes/ko/v2.0.0-alpha.0.md) | v2.0 stability line opens: read-only artifact schema migration checks (`relay-baton migrate`, `ARTIFACT_SCHEMA_VERSIONS` registry, `doctor --deep` schema lines). Detection + guidance only. |
| v1.9.0-alpha.0 | [Read →](./release-notes/v1.9.0-alpha.0.md) | [읽기 →](./release-notes/ko/v1.9.0-alpha.0.md) | Team handoff package: portable `handoff bundle` (manifest + SHA-256 + redaction pass), `handoff inspect`, a markdown `report`, and a desktop team-handoff export card + Agent Room `/bundle` `/report`. No cloud upload. |
| v1.8.0-alpha.1 | [Read →](./release-notes/v1.8.0-alpha.1.md) | [읽기 →](./release-notes/ko/v1.8.0-alpha.1.md) | Project intelligence complete: `relay-baton profile` (framework tags + recommended commands), `inventory` (scripts/packages/CI/release files), and a desktop project-inspector panel + Agent Room `/workspace` `/profile` `/inventory`. |
| v1.8.0-alpha.0 | [Read →](./release-notes/v1.8.0-alpha.0.md) | [읽기 →](./release-notes/ko/v1.8.0-alpha.0.md) | Project intelligence start: deterministic, bounded `relay-baton workspace` map (package managers, languages, monorepo packages, scripts, entry points, docs, AGENTS/CLAUDE files). No semantic indexing. |
| v1.7.0-alpha.0 | [Read →](./release-notes/v1.7.0-alpha.0.md) | [읽기 →](./release-notes/ko/v1.7.0-alpha.0.md) | Guarded execution workflow: deterministic read-only execution checkpoints (`checkpoint add`/`list`/`summary`), a `guard` stop-condition policy, a `risk` classifier, and a desktop guarded-execution panel + Agent Room `/checkpoints` `/guard` `/risk`. |
| v1.6.0-alpha.0 | [Read →](./release-notes/v1.6.0-alpha.0.md) | [읽기 →](./release-notes/ko/v1.6.0-alpha.0.md) | Session archives, recovery, and desktop browsing: read-only `session list`/`inspect`/`resume` with manifest + SHA-256 integrity and stale/incomplete diagnosis, plus a desktop session-archive panel and Agent Room `/sessions` `/inspect` `/resume`. |
| v1.5.0-alpha.1 | [Read →](./release-notes/v1.5.0-alpha.1.md) | [읽기 →](./release-notes/ko/v1.5.0-alpha.1.md) | Distribution cleanup: opt-in/manual desktop updater wiring, signed updater artifact/latest.json release support, v1.4 deferred-item closure, and v1.6-to-v2.0 roadmap. |
| v1.5.0-alpha.0 | [Read →](./release-notes/v1.5.0-alpha.0.md) | [읽기 →](./release-notes/ko/v1.5.0-alpha.0.md) | Git tracking first cut: read-only `relay-baton git status --json`, non-git project fallback, desktop Git panel, and `/git` in Agent Room. |
| v1.4.0-alpha.1 | [Read →](./release-notes/v1.4.0-alpha.1.md) | [읽기 →](./release-notes/ko/v1.4.0-alpha.1.md) | Distribution polish: one-line CLI installers with SHA-256 verification, release SHA256SUMS/SBOM metadata, package-manager templates, optional signing hooks, and a desktop Codex/Claude preview switcher. |
| v1.3.0-alpha.1 | [Read →](./release-notes/v1.3.0-alpha.1.md) | [읽기 →](./release-notes/ko/v1.3.0-alpha.1.md) | Desktop Agent Room UX revamp: tabbed dashboard/room, full-height chat, handoff modal, slash-command palette with descriptions, decluttered buttons, and a full `?` usage guide (en/ko/ja/zh). |
| v1.3.0-alpha.0 | [Read →](./release-notes/v1.3.0-alpha.0.md) | [읽기 →](./release-notes/ko/v1.3.0-alpha.0.md) | Desktop conversation + project-scoped sessions: Agent Room composer, persisted conversation events via `conversation append`, visible project/session context, and confirmation-first slash actions. |
| v1.2.0-alpha.3 | [Read →](./release-notes/v1.2.0-alpha.3.md) | [읽기 →](./release-notes/ko/v1.2.0-alpha.3.md) | Desktop project management + i18n: add projects with the folder picker, switch/remove projects in the GUI, register non-git project folders, and switch UI chrome between English/Korean/Japanese/Simplified Chinese. |
| v1.2.0-alpha.2 | [Read →](./release-notes/v1.2.0-alpha.2.md) | [읽기 →](./release-notes/ko/v1.2.0-alpha.2.md) | Desktop sidecar fix: the GUI now actually reaches the bundled CLI (`withGlobalTauri` + `window.__TAURI__`), so status/budget/handoff/timeline panels populate. |
| v1.2.0-alpha.1 | [Read →](./release-notes/v1.2.0-alpha.1.md) | [읽기 →](./release-notes/ko/v1.2.0-alpha.1.md) | Desktop prerelease completed: fixes the Windows `.msi` build (non-numeric prerelease) so all 6 assets ship; adds Phase D — signing docs, window-state persistence, light/dark toggle, TUI-mirrored keyboard shortcuts. |
| v1.2.0-alpha.0 | [Read →](./release-notes/v1.2.0-alpha.0.md) | [읽기 →](./release-notes/ko/v1.2.0-alpha.0.md) | Desktop GUI prerelease (Phase A+B): `build-desktop` release job (.dmg/.msi/.AppImage), deterministic icons, sidecar staging, read-only dashboard, and CLI JSON surface (`project list/current --json`, `handoff show`). Unsigned installers. |
| v1.1.3 | [Read →](./release-notes/v1.1.3.md) | [읽기 →](./release-notes/ko/v1.1.3.md) | Distributable (shipped): per-OS standalone executables (Node SEA) attached to the GitHub Release, automated `release.yml` pipeline, README downloads, Tauri desktop scaffold. (v1.1.0–1.1.2 were release-pipeline hotfixes.) |
| v1.0.0 | [Read →](./release-notes/v1.0.0.md) | [읽기 →](./release-notes/ko/v1.0.0.md) | Stable Local Release: frozen config/session contracts, `.ai-session/` artifact validation (`doctor --deep`), full command reference (`docs/COMMANDS.md` EN+KO), finalized Agent Room set with read-only `/diagnose`. |
| v0.9.0 | [Read →](./release-notes/v0.9.0.md) | [읽기 →](./release-notes/ko/v0.9.0.md) | Automation & Runtime (bounded): `LoopController`, `/continue --max-steps N`, `/replan`, `relay-baton replay` / room `/replay`, adaptive per-agent compression thresholds. |
| v0.8.0 | [Read →](./release-notes/v0.8.0.md) | [읽기 →](./release-notes/ko/v0.8.0.md) | Adapter Expansion + Agent Room (first cut): OpenCode/Gemini/Aider scaffolds, project-level fallback overrides, OS CI matrix, `relay-baton chat`/`room` (turn-based, confirmation-first REPL). |
| v0.7.0 | [Read →](./release-notes/v0.7.0.md) | [읽기 →](./release-notes/ko/v0.7.0.md) | Review & Diagnose: `relay-baton review` (deterministic diff-vs-plan), execution receipts, plan diffing, `--json` for status/budget/review, conversation event schema (draft). |
| v0.6.0 | [Read →](./release-notes/v0.6.0.md) | [읽기 →](./release-notes/ko/v0.6.0.md) | Trust & Verify: `relay-baton verify` (simulated E2E, no model calls), `doctor --deep`, TUI mode panel, `docs/ROADMAP.md`. |
| v0.5.0 | [Read →](./release-notes/v0.5.0.md) | [읽기 →](./release-notes/ko/v0.5.0.md) | Plan-execute mode (`plan` / `execute`, planner→executor, PlanQualityGate) + context-compression mode (`compress-context`). |
| v0.4.0 | [Read →](./release-notes/v0.4.0.md) | [읽기 →](./release-notes/ko/v0.4.0.md) | GitHub Actions CI, critical-path tests, CLI smoke test, session observability, `handoff history`. |
| v0.3.0 | [Read →](./release-notes/v0.3.0.md) | [읽기 →](./release-notes/ko/v0.3.0.md) | Side-effect-free `ProjectResolver`, registry recovery with backup on corrupt `projects.json`, `RELAY_BATON_PROJECTS_FILE` override, `lastError` cleanup on fallback. |
| v0.2.0 | [Read →](./release-notes/v0.2.0.md) | [읽기 →](./release-notes/ko/v0.2.0.md) | Multi-project registry, `--project` / `--path`, project CLI commands, improved TUI dashboard, `.gitattributes`. |
| v0.1.0 | [Read →](./release-notes/v0.1.0.md) | [읽기 →](./release-notes/ko/v0.1.0.md) | Initial MVP for Codex-to-Claude handoff with token diet, fallback detection, quality gates, and auth-safe subprocess execution. |

## Smoke test

After any change:

```bash
pnpm build
pnpm test
pnpm relay-baton doctor
pnpm relay-baton project add /path/to/relay-baton --name relay-baton --diet caveman
pnpm relay-baton status --project relay-baton
pnpm relay-baton handoff --to claude --no-run --project relay-baton --diet caveman
pnpm relay-baton budget
```

## Contributing

Issues and PRs welcome. For larger changes, open a short RFC issue first.

```bash
git clone https://github.com/dgl1231/relay-baton
cd relay-baton
pnpm install
pnpm build
pnpm test
```

## License

MIT. See [`LICENSE`](./LICENSE).

---

<div align="center">

**Translations** ·
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
