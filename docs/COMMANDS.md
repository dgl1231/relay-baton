# relay-baton Command Reference (v1.0)

Complete reference for the `relay-baton` CLI. relay-baton is a local handoff +
token-diet harness: it runs Codex CLI first, detects fallback, and produces a
compact handoff so Claude Code can continue. It never calls model APIs directly,
never stores/prints API keys, and never auto-commits/pushes/PRs.

## Global conventions

Most commands accept the project-targeting options below. The repository root is
resolved by priority: `--path` > `--project` > active project > current working
directory.

| Option | Meaning |
| --- | --- |
| `--path <repoPath>` | Operate on an explicit repository path. |
| `--project <name-or-id>` | Operate on a registered project. |
| `--diet <profile>` | Token-diet profile: `off` \| `lite` \| `balanced` \| `caveman` \| `ultra`. |
| `--json` | Print machine-readable JSON (where supported). |
| `--allow-api-key-env` | Pass `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` through to the child process. Blocked by default. |
| `--force` | Ignore quality-gate failures. |

## Session lifecycle

### `init`
Initialize `.ai-session/` in the target repository (idempotent; never overwrites
existing files).

### `status [--json]`
Show the current session status (`session.json` summary).

### `doctor [--deep]`
Check the local environment: git, agent CLIs, auth env presence (values never
printed), `.ai-session`. With `--deep`, also validates the **config contract**
(`validateConfig`) and **artifact shapes** (`validateArtifacts`), plus tooling,
adapter args, registry, plan/handoff/compression health. See
[ARTIFACTS.md](ARTIFACTS.md).

### `verify [--diet] [--real-agents] [--keep-temp] [--verbose]`
Simulated end-to-end check of the pipeline against a throwaway temp repo. Never
executes real agents (`--real-agents` is scaffold-only).

### `login [agent] [--allow-api-key-env]`
Run the Codex / Claude Code interactive login flows. `agent` is `codex` |
`claude` | `all` (default `all`).

## Run & handoff

### `run <task>`
Run Codex CLI first; on usage/rate/token/context/quota fallback, generate a
handoff and run Claude Code. Options: `--diet`, `--force`, `--allow-api-key-env`,
`--project`, `--path`.

### `handoff --to <agent>`
Generate a handoff document and optionally launch the next agent. Options:
`--to <agent>` (required, e.g. `claude`), `--diet`, `--force`, `--no-run` (do not
launch), `--allow-api-key-env`.

### `handoff history`
List past handoff documents (current + timestamped backups).

### `handoff show [--file <name>] [--json]`
Print a handoff document read-only (the current `handoff.md` by default, or a
named history file from `handoff history`). Exists so display surfaces (e.g.
the desktop webview) read the handoff through the CLI instead of touching
`.ai-session/` directly.

## Plan / execute

### `plan <task>`
Plan-execute mode: a planner agent writes `.ai-session/plan.md`. Options:
`--with`/`--planner <agent>`, `--executor <agent>`, `--no-run` (scaffold an empty
template), `--then-execute` (run execute after a passing plan), `--diet`,
`--force`, `--allow-api-key-env`.

### `execute`
Plan-execute mode: an executor agent implements `.ai-session/plan.md`. Options:
`--with <agent>`, `--from <path>`, `--diet`, `--force`, `--allow-api-key-env`.

### `receipt done <step> [--note]` / `receipt skip <step> [--note]` / `receipt list [--json]`
Append-only execution receipts for plan steps (`<step>` is the 1-based index).

## Token diet

### `compact` (alias `squeeze`)
Recompute compact-state, repo-map, and the diff snapshot. Option: `--diet`.

### `compress-context [--threshold <ratio>] [--dry-run] [--force]`
Compress the running session context (`state.md` / `commands.log`) when over
budget. `--threshold` is a `0..1` ratio; `--dry-run` reports without writing.

### `compress <file> [--write] [--out <path>]`
Deterministically compress a single markdown/instruction file.

### `budget [--json]`
Show context-budget usage.

## Agent Room & replay

### `chat` (alias `room`)
Agent Room: turn-based, confirmation-first multi-agent REPL. Option
`--allow-api-key-env`. In-room commands include `handoff`, `run`, `plan`,
`execute`, `review`, `diagnose`, `budget`, `status`, `continue`, `replan`,
`replay`. See [AGENT_ROOM.md](AGENT_ROOM.md).

### `replay [--json] [--session <id>] [--kind <kinds>] [--limit <n>]`
Replay the recorded conversation timeline (`conversation.jsonl`), read-only.

### `conversation append <text> [--role <role>] [--kind <kind>] [--json]`
Append one event to the current project session's `conversation.jsonl`. Desktop
uses this for composer messages and command echoes instead of writing session
files directly. Requires an initialized `.ai-session`.

### `review [--json]`
Deterministically review the working-tree diff against the current plan (no model
call).

## Projects

### `project add <path> [--name] [--diet] [--primary] [--fallback] [--json]`
Register an existing directory as a project. The directory does not have to be a
git repository, though git-backed commands such as `run` and `handoff` still
require git. `--json` emits `{ added, project }` for sidecar/GUI integrations.

### `project list [--json]` / `project current [--json]` / `project switch <name-or-id>` / `project remove <name-or-id> [--json]` / `project doctor`
Manage the project registry (default `~/.relay-baton/projects.json`).
`list --json` / `current --json` emit machine-readable output for display
surfaces (desktop dashboard, scripts). `remove --json` emits `{ removed }`.

## TUI

### `tui`
Start the Ink-based project/session dashboard. Keys: `q` quit, `r` refresh, `p`
next project, `d` cycle diet, `b` budget reload, `h` handoff (no-run). The TUI
never spawns real agents.
