# relay-baton Guide

A single entry point to relay-baton's public docs: install, quickstart, the
desktop and CLI workflows, project management, the artifact model, and the
safety model. For the full command reference see [COMMANDS.md](./COMMANDS.md)
([한국어](./i18n/COMMANDS.ko.md)); Korean version of this guide:
[GUIDE.ko.md](./i18n/GUIDE.ko.md).

relay-baton is a local handoff harness: it carries the *minimum sufficient
state* between coding agents (Codex CLI ↔ Claude Code) without re-pasting the
chat log, the diff, or the repo. It is local-first, subprocess-only, and
deterministic.

## Install

Fastest path — prebuilt single-file binary, no Node required to run it:

```bash
# macOS / Linux (downloads, verifies SHA256SUMS, installs to a user PATH dir)
curl -fsSL https://raw.githubusercontent.com/dgl1231/relay-baton/main/install/install.sh | sh
```

```powershell
# Windows PowerShell
iwr https://raw.githubusercontent.com/dgl1231/relay-baton/main/install/install.ps1 -UseB | iex
```

Or grab a binary / desktop installer from the
[latest release](https://github.com/dgl1231/relay-baton/releases/latest). The
full step-by-step (build from source, install Codex/Claude CLIs, login) lives in
[install/install.md](../install/install.md).

> relay-baton itself never calls the OpenAI / Anthropic API. It runs your
> logged-in `codex` / `claude` CLIs as subprocesses and uses their subscription
> quota. You still need those CLIs installed and logged in.

## Quickstart

```bash
relay-baton doctor                 # check git, codex, claude, env, config
relay-baton init                   # create .ai-session/ in the current repo
relay-baton run "fix the flaky upload test" --diet balanced
```

When the primary agent hits a quota/context wall, relay-baton detects it, builds
a compact handoff from the repo's actual state, and resumes in the fallback
agent. Inspect progress with `relay-baton status`, `budget`, and `replay`.

## CLI workflow

Grouped; see [COMMANDS.md](./COMMANDS.md) for every flag.

- **Session**: `init`, `status`, `doctor [--deep]`, `verify`, `migrate`.
- **Run & handoff**: `run` (incl. `--handoff-now` manual trigger + optional
  `handoffTriggers` threshold suggestions + advisory routing hints, v1.2.0),
  `route`, `handoff [--to] [--no-run]`, `handoff show`,
  `handoff history`, `handoff bundle`, `handoff inspect`, `report`.
- **Plan / execute**: `plan`, `execute`, `receipt`, `checkpoint`, `guard`,
  `risk`.
- **Project intelligence**: `workspace`, `profile`, `inventory`.
- **Session archives**: `session archive` / `list` / `inspect` / `resume`.
- **Projects**: `project add` / `list` / `switch` / `current` / `remove`.
- **Token diet**: `compact`, `compress-context`, `budget`.

Most read-only surfaces support `--json` for scripting.

## Desktop workflow

The desktop app is a Tauri shell over the same CLI (it calls the CLI sidecar —
no business logic in the webview). It provides a read-only dashboard plus an
Agent Room:

- **Dashboard**: status, budget, git, session archives, guarded execution,
  project inspector, team handoff, updates.
- **Agent Room**: conversation timeline + a slash-command palette
  (`/status`, `/git`, `/review`, `/sessions`, `/guard`, `/risk`, `/workspace`,
  `/bundle`, `/report`, …). Read-only commands run inline; agent-launching
  commands are preview/copy-first.
- **i18n**: English / 한국어 / 日本語 / 简体中文, with parity enforced by tests.

Mutating agent actions are never launched from the GUI — they are previewed for
you to copy into a terminal.

## Project registry

Register multiple repos and switch the active one:

```bash
relay-baton project add /path/to/repo --diet caveman
relay-baton project switch repo
```

The registry lives at `~/.relay-baton/projects.json`. Repo resolution order is
`--path` > `--project` > active project > cwd. relay-baton still works with no
registered project (it uses the cwd).

## Artifacts & schema

Session state lives under `.ai-session/` (handoff, compact state, repo map,
plan, checkpoints, git baseline, session.json, conversation log, …). See
[ARTIFACTS.md](./ARTIFACTS.md). Versioned artifacts carry a `schemaVersion`;
`relay-baton migrate --check` reports schema status and `migrate --apply`
normalizes legacy artifacts (with a backup).

## Safety model

- **No direct LLM API calls.** relay-baton drives `codex` / `claude` as
  subprocesses; it never embeds a provider SDK (enforced by tests).
- **No API-key storage or printing.** `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`
  are blocked from child processes unless `--allow-api-key-env` is passed.
- **No auto commit / push / PR.** Mutating git actions are the human's call.
- **No daemon, no real-time chat platform, no default semantic/vector
  indexing.** Compaction and project intelligence are deterministic.
- **Read-only or confirmation-first** everywhere it matters; bundles and
  migrations back up before writing and support `--dry-run`.

See also: [RELEASE.md](./RELEASE.md) (distribution & update channels),
[ROADMAP.md](./ROADMAP.md).
