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

## Work items (named sessions, v2.6)

A repo can hold multiple named work items. The legacy flat `.ai-session/` is the
`default` item (zero migration); named items live under
`.ai-session/sessions/<name>/`. All commands (`run`/`handoff`/`status`/`usage`/…)
operate on the **active** item.

### `session new <name> [--switch] [--agent <id>] [--no-init] [--json]`
Create a named work item. `--switch` makes it active; `--agent` pins it to an
agent; `--no-init` skips creating its `.ai-session` artifacts.

### `session switch <name>` (alias `use`)
Set the active work item (`default` = the legacy flat session).

### `session items [--json]`
List work items and which one is active (read-only).

### `session assign <name> <agent>`
Pin a work item to an agent (or `none` to clear). `run` then uses it as the
default primary in the relay chain.

### `session remove <name> [--delete-files]`
Remove a named work item (never `default`); `--delete-files` also deletes its dir.

### `session worktree add <name> [--branch <b>] [--worktree-path <dir>]`
Back a work item with an isolated **git worktree** (default
`<parent>/<repo>.worktrees/<name>`, branch `relay/<name>`). After this, `run` for
that active item executes in the worktree (own working tree + own `.ai-session`),
so parallel work items never clobber each other's git state.

### `session worktree remove <name> [--force]`
Remove the work item's worktree (commit/stash changes first, or `--force`).

### `session archive [--json] [--dry-run] [--out <dir>]`
Archive the current `.ai-session/` artifacts into a local relay-baton archive
directory without modifying the source repository.

The v1.6 first cut writes a directory archive plus `manifest.json` with file
sizes and SHA-256 checksums. It does not prune, delete, zip, upload, or mutate
the source project.

### `session list [--json] [--out <dir>]`
List archived sessions found under the archive root (default
`~/.relay-baton/session-archives`), newest first. Read-only: reads each
`manifest.json` and reports id, file count, total bytes, and `createdAt`. Invalid
archives (missing/broken manifest) are listed with a `valid: false` flag. Degrades
cleanly when the archive root does not exist.

### `session inspect <archive> [--json] [--out <dir>]`
Validate a single archive by id or path against its `manifest.json`. Reports
`repoRoot`, `createdAt`, file count, total bytes, and per-file integrity
(presence + size + SHA-256). `missing`/`corrupt` lists and an `intact` flag
summarize the result. Read-only: it never copies, applies, or restores anything.

### `session export <archive> --to <dir> [--overwrite] [--json]`
Copy an archived session (by id or path) out to a destination directory for
sharing or backup. Read-only on the archive; writes only under `<dir>/<id>`.
Refuses to overwrite an existing destination unless `--overwrite` is passed.

### `session prune [--max-age-days <n>] [--max-count <n>] [--apply] [--json]`
Apply a retention policy to the session-archive root. **Disabled by default** —
with no `--max-age-days`/`--max-count` nothing is pruned. An archive is a prune
candidate if it violates any given constraint (older than N days, or beyond the
newest N). **Dry-run by default**: it previews candidates and only deletes with
`--apply`. Archives with an unknown `createdAt` are never pruned by age.

### `session resume [--json] [--stale-hours <n>]`
Diagnose the current `.ai-session` and suggest the safest next command. Classifies
the session as `missing`, `incomplete`, `stale`, or `ok` from required-file
presence, `session.json` validity/schema, git baseline drift, and `updatedAt` age
(default stale threshold 24h). Read-only: it only reads and recommends — it never
runs the suggested commands. Typical suggestions: `init` (re-scaffold),
`status`/`replay` (resume context), `review`/`handoff`/`session archive` (stale).

### `doctor [--deep]`
Check the local environment: git, agent CLIs, auth env presence (values never
printed), `.ai-session`. With `--deep`, also validates the **config contract**
(`validateConfig`) and **artifact shapes** (`validateArtifacts`), plus tooling,
adapter args, registry, plan/handoff/compression health, and **artifact schema
versions** (see `migrate`). See [ARTIFACTS.md](ARTIFACTS.md).

### `migrate [--check] [--apply] [--dry-run] [--json]`
Check the schema version of each versioned `.ai-session` artifact
(`session.json`, `git-baseline.json`, `checkpoints.jsonl`) against the current contract
(`ARTIFACT_SCHEMA_VERSIONS`) and report guidance: `ok`, `outdated` (older than
current), `ahead` (written by a newer CLI), `legacy` (no `schemaVersion` field —
treated as v1), or `unreadable`. Default behavior (and `--check`) is read-only.

With `--apply`, safe migrations run: **legacy normalization** stamps the current
`schemaVersion` on artifacts that lack it. Each change writes a timestamped
`.bak.<ts>` backup first; `--apply --dry-run` previews the plan without writing.
Version-to-version upgrades are reported but skipped until their migrator is
registered (added with the first real schema-version bump). Idempotent.

### `verify [--diet] [--real-agents] [--keep-temp] [--verbose]`
Simulated end-to-end check of the pipeline against a throwaway temp repo. Never
executes real agents (`--real-agents` is scaffold-only).

### `login [agent] [--allow-api-key-env]`
Run an agent CLI's interactive login flow. `agent` is `codex` | `claude` |
`opencode` | `gemini` | `aider` | `cursor` | `all` (default `all` = the
first-class Codex+Claude pair). Each flow is driven by the agent registry
(install URL, login subcommand or interactive steps). Aider has no login command
— it uses provider API keys via env (blocked by default; see
`--allow-api-key-env`).

#### Supported agent matrix (v2.3)
- **First-class:** `codex`, `claude` — the default relay, exercised end-to-end.
- **Supported:** `opencode`, `gemini`, `aider`, `cursor` (`cursor-agent`) — real
  adapters with install + login flows + agent-specific fallback patterns; usable
  as primary/fallback/planner/executor via config or `--with`/`--planner`/
  `--executor`. `doctor` reports each agent's availability and tier.

## Run & handoff

### `run <task>`
Run a **relay chain**: the first agent runs the task; on a
usage/rate/token/context/quota fallback signal, relay-baton builds a handoff and
hands off to the next agent. Repeats down the chain until an agent finishes
without a fallback or the chain is exhausted.

The chain (deterministic "who's next" policy, v2.3):
- `--chain <a,b,c>` — explicit N-way chain (overrides the pair below).
- else `--primary <agent>` / `--fallback <agent>`, falling back to project
  overrides, then config `primaryAgent`/`fallbackAgent`.

Supports reverse relay (e.g. `--primary claude --fallback codex`) and longer
chains, not just codex→claude. Other options: `--diet`, `--force`,
`--allow-api-key-env`, `--project`, `--path`.

**Bounded auto-orchestration (v2.5):** `--until <n>` runs up to N extra
continue-steps on the completing agent — strictly bounded and **confirmation-first**
(each step prompts unless `--yes`). It is gated by the guardrail policy (max
steps/changed-files/budget) and stops on divergence or budget ceiling. Never an
unattended daemon; each step records a checkpoint + usage event.

**Broadened handoff triggers (v2.8):** even after a clean exit, relay-baton can
suggest passing the baton:
- `--handoff-now` — manual trigger: relay to the next agent after each hop
  without waiting for a fallback signal (the flag itself is the explicit consent).
- Optional `handoffTriggers` config block — when a threshold is reached after a
  clean exit, `run` asks `hand off to <agent> now? [y/N]` (pre-approve with
  `--yes`). Absent config = unchanged, error-pattern-only detection. When stdin
  is not a TTY the prompt auto-declines instead of hanging.

```jsonc
{
  "handoffTriggers": {
    "budgetRatio": 0.8,        // handoff chars / maxHandoffChars (0..1)
    "changedFiles": 30,        // working-tree changed files
    "usageTokensProxy": 100000 // session UsageLedger token proxy total
  }
}
```

**Advisory routing hint (v2.8):** when the task's words match a different
agent's registry `strengths` tags, `run` prints a one-line chain suggestion.
Display only — it never changes the resolved chain, and explicit
`--chain`/`--primary` suppress it.

### `route <task> [--json]`
Read-only preview of the v2.8 **advisory routing hint**: resolves the relay
chain exactly like `run` (flags > work-item assignment > project > config), then
shows how the registry `strengths` tags would reorder it for this task, with the
matched keywords per agent. Never launches an agent, never writes session state.
Options: `--primary`, `--fallback`, `--chain`, `--project`, `--path`.

### Project recipes / hooks (v2.5)
Optional, opt-in, **local-only** command hooks declared in config — no daemon,
no network, env sanitized like an agent's (provider keys stripped by default).
Absent config = nothing runs; the chain stops on the first failing command.

```jsonc
{
  "hooks": {
    "preHandoff":  ["pnpm build"],          // before each handoff is built
    "postExecute": ["pnpm test", "pnpm lint"] // after an agent finishes
  }
}
```

### `handoff --to <agent>`
Generate a handoff document and optionally launch the next agent. Options:
`--to <agent>` (required, e.g. `claude`), `--diet`, `--force`, `--no-run` (do not
launch), `--allow-api-key-env`.

Both `run` and `handoff` apply a **Redaction Gate**: the generated handoff (what
the next agent reads) is scanned for secrets/API keys/private keys; high-severity
findings block launching the next agent unless `--force`. Absolute home paths and
oversized content are medium-severity warnings only.

`--allow-api-key-env` is audited: when it passes a blocked provider key env var
through to the child agent, relay-baton records a conversation event with the
variable **names only** (values are never read, logged, or stored).

### `handoff history`
List past handoff documents (current + timestamped backups).

### `handoff show [--file <name>] [--json]`
Print a handoff document read-only (the current `handoff.md` by default, or a
named history file from `handoff history`). Exists so display surfaces (e.g.
the desktop webview) read the handoff through the CLI instead of touching
`.ai-session/` directly.

### `handoff bundle [--json] [--dry-run] [--out <dir>]`
Build a small, portable **handoff bundle** from curated `.ai-session` artifacts
(handoff, compact state, repo map, plan + receipts, decisions, changed files,
test results, errors, session.json) plus a git summary, into a timestamped
directory under `~/.relay-baton/handoff-bundles` (or `--out`). Writes
`manifest.json` (size + SHA-256 per file) and a `redaction.json` from a
deterministic **redaction pass** (obvious secrets, API keys, absolute home
paths, oversized files). Read-only on the source repo; no model calls.

### `handoff inspect <bundle> [--json] [--out <dir>]`
Validate a bundle by id or path against its manifest (per-file presence + size +
SHA-256) and print what it contains — repoRoot, createdAt, git summary, file
count, integrity, and recorded redaction findings. Applies nothing.

### `report [--out <file>] [--json]`
Generate a human-readable **markdown status report** (task, status, git, execution
checkpoints, handoff excerpt) for PR comments, issues, or team chat — from
existing artifacts only. Prints to stdout, or writes to `--out <file>`. Read-only,
no model calls.

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

### `checkpoint add <step> [--command <s>] [--result ok|fail|pending] [--note <s>] [--json]`
Record an append-only **execution checkpoint** for a bounded execute step
(`<step>` is the 1-based index). Each checkpoint captures a deterministic,
read-only snapshot: the command preview, the changed-file list, a git summary
(branch/head/changed/clean), a budget snapshot (active profile + handoff chars),
the result, and a timestamp. Checkpoints are never rewritten — a correction is a
new checkpoint, stored one JSON object per line in `.ai-session/checkpoints.jsonl`.
No model calls.

### `checkpoint list [--json]`
List recorded execution checkpoints in order. Tolerant of malformed lines.

### `checkpoint summary [--json]`
Compact, handoff/archive/review-ready **execution receipt** derived from the
recorded checkpoints: total count, results breakdown (ok/fail/pending), last
step/command/result, max changed files in a step, and the latest budget
snapshot. Deterministic, read-only, no model calls.

### `guard [--json] [--exit-code]`
Evaluate the **stop-condition guardrails** against recorded checkpoints plus live
git/budget state, and report whether execution should stop. Deterministic and
read-only — it never halts an agent itself; relay-baton reports and the
human/agent decides. Caps come from the `guardrails` config block (defaults:
`maxSteps` 25, `maxChangedFiles` 40, `maxBudgetRatio` 0.9, `requireConfirmation`
true). `--exit-code` makes a triggered stop condition exit non-zero (10) so a
script/agent loop can halt; without it the command always exits 0.

### `risk [--json]`
Deterministically flag **risky surfaces** in the working tree from the git
status: dependency manifests/lockfiles, file deletions (high severity),
release/CI edits, env/build config changes, and binary/generated artifacts. Each
finding carries a category, severity, and reason. Read-only, no model calls.

### `workspace [--json]`
Deterministic, bounded **workspace map** built straight from manifest/config
files: detected package managers, languages, monorepo packages, npm scripts
(build/test/lint + others), entry points, docs, and AGENTS/CLAUDE files. No
file-content scanning beyond known manifests, no semantic indexing, no model
calls.

### `profile [--json]`
Deterministic **project profile hints** combining the workspace map with config
and the registered project's defaults: framework tags, recommended build/test
commands (explicit config commands win, else derived from scripts + package
manager), diet/agent defaults, excluded paths, and entry points. Read-only.

### `inventory [--json]`
Bounded **inventory** of package scripts, workspace packages (with their
scripts), CI workflows, release files, and dependency manifests. Reads known
manifest/config locations only — no full-repo scanning, no model calls.

## Token diet

### `compact` (alias `squeeze`)
Recompute compact-state, repo-map, and the diff snapshot. Option: `--diet`.

### `compress-context [--threshold <ratio>] [--dry-run] [--force]`
Compress the running session context (`state.md` / `commands.log`) when over
budget. `--threshold` is a `0..1` ratio; `--dry-run` reports without writing.

### `compress <file> [--write] [--out <path>]`
Deterministically compress a single markdown/instruction file.

### `budget [--json]`
Show context-budget usage (current artifact sizes vs the active profile).

### `usage [--json]`
Show **local** per-session usage from `.ai-session/usage.jsonl`: a token/quota
*proxy* (`ceil(chars/4)`, not a real tokenizer) accumulated across runs/handoffs,
with per-type/per-agent breakdown, handoff count, and a budget ratio vs the
active profile. Read-only and local — nothing is ever transmitted.

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
