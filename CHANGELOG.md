# Changelog

All notable changes to relay-baton are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Per-release detail (EN + KO) lives in [`release-notes/`](./release-notes/). This
file is the condensed, user-facing history.

## [1.6.0] — 2026-07-21

Desktop-only release; CLI behavior unchanged (versions in lockstep).

### Changed
- **Windows desktop installer switched from MSI to a brand-styled NSIS
  `…-setup.exe`.** Warm-dark welcome/finish panel matching the app (orange
  diamond mark + `relay-baton` wordmark + `codex → claude handoff` tagline),
  and **per-user install with no UAC prompt** (installs to the user profile
  like VS Code/Discord). Brand images live in
  `desktop/src-tauri/installer/`; configured via `bundle.windows.nsis`.
- Release workflow now uploads `bundle/nsis/*-setup.exe` for Windows; docs
  updated. CLI package channels (npm/Homebrew/Scoop/Winget), macOS `.dmg`,
  and Linux `.AppImage` are unaffected.

> Upgrading from a prior MSI install: uninstall the old entry once
> (Settings → Apps), then run the new `…-setup.exe`.

## [1.5.1] — 2026-07-20

Follow-ups to v1.5.0's desktop agent execution.

### Fixed
- **`run` and `execute` now exit `4` when the chain ends on an agent that
  ran but exited non-zero** (previously exit `0`). The desktop run card keys
  its chip off the exit code, so a failed ending now shows red instead of a
  green `done`. Exit codes: `0` success · `1` spawn failure · `2` usage ·
  `3` gate block · `4` failed agent ending.
- Desktop live run card no longer shows claude's routine `rate_limit_event`
  telemetry lines (suppressed in `ClaudeCodeAdapter.parseEvent`; the raw line
  still reaches fallback detection and the on-disk log).

## [1.5.0] — 2026-07-16

Desktop feature release; CLI behavior unchanged (versions in lockstep).

### Added
- **Run agents from the desktop app (confirmation-first).** New `/run
  <task>` Agent Room command and a **Run here** button on the `/plan`,
  `/execute`, and `/handoff` confirm modals — the exact command is shown
  and nothing runs without the click, matching the AGENT_ROOM design
  (preview → confirm → run). Output streams into a live timeline card
  (`--pretty` formatting) with a Cancel button; on exit the card gets a
  green `done` / red `exit N` chip and panels refresh. One run at a time,
  output capped at 400 lines, card survives timeline reloads.
- Tauri capabilities: scoped `shell:allow-spawn` for the sidecar and
  `shell:allow-kill` for cancel.

### Changed
- The header Codex/Claude toggle now selects the agent that actually runs
  (`--primary` / `--with`); `handoff` from the GUI launches the target
  agent (dropped `--no-run`).
- Guide/tooltip strings in all 4 GUI locales updated from "read-only" to
  confirmation-first.

## [1.4.1] — 2026-07-16

Desktop-only patch; no CLI changes.

### Fixed
- **Result cards no longer vanish from the Agent Room timeline.** Local
  cards are kept in memory and merged back by timestamp on every timeline
  reload (cleared on project switch, capped at 50) — previously only the
  most recent command's card was ever visible.

### Improved
- **Role-coded timeline rows** — user rows get a blue left border, a lighter
  background, and monospace command text; relay-baton rows an amber border;
  claude/codex rows their agent colors. User vs relay-baton conversation now
  reads apart at a glance, in both themes.

## [1.4.0] — 2026-07-15

### Added
- **`--pretty` on `run`/`plan`/`execute`/`handoff`** — friendly rendering of
  the agent CLI's structured output stream. Requests JSONL events
  (`claude -p --output-format stream-json --verbose`, `codex exec --json`)
  and renders assistant text, dim `· thinking:` / `→ tool` lines, and a
  closing `✓ agent turn done — in/out tok · $ · s` receipt. Deterministic
  line-by-line parsing only (adapter `parseEvent`); unparsed lines and
  unsupported agents fall back to raw; the raw stream still lands in
  `.ai-session/commands.log`; fallback detection keeps matching raw lines.
- **Desktop: structured result cards in the Agent Room** — `/status`,
  `/budget`, `/git`, `/review`, `/guard`, `/risk`, `/checkpoints`,
  `/sessions`, `/resume` and the generic commands render as cards (status
  chips, budget gauge, per-file git rows, plan-step checklists) instead of
  raw `JSON.stringify` dumps, each with a collapsed **raw json** section.
- `AgentEvent` gains additive event types (`system`, `assistant_text`,
  `reasoning`, `tool_use`, `usage`) and `AgentUsage`.

### Fixed
- Desktop: `/review` results were wiped from the timeline immediately after
  rendering (timeline reload raced the card append).

## [1.3.1] — 2026-07-10

### Fixed
- **Desktop app failed to open at all on unsigned builds** (every MSI/DMG/
  AppImage since the updater was introduced). The Rust shell registered the
  Tauri updater plugin unconditionally while the release workflow only injects
  `plugins.updater` config when signing secrets exist, so unsigned builds
  panicked at startup (exit 101) before showing a window. The plugin is now
  registered only when its config block is present. No CLI changes.

## [1.3.0] — 2026-07-10

Post-GA polish release.

### Added
- **`relay-baton route "<task>" [--json]`** — read-only preview of the advisory
  routing hint: resolves the chain like `run`, shows how registry `strengths`
  tags would reorder it, with matched keywords per agent. Never launches an
  agent.
- **Record-ready demo scenario** — `scripts/demo/demo.sh` + fake agents replay
  the fallback → compact handoff → resume flow deterministically (no quota).

### Improved
- Friendly `ui` output extended to `doctor`, `init`, `status`, `login`, and
  `handoff` (`doctor`/`login` previously hardcoded ANSI and ignored
  `NO_COLOR`/non-TTY).
- `doctor` reports whether the optional `handoffTriggers` block is configured.
- v1.2.0 features (`--handoff-now`, `handoffTriggers`, routing hints) fully
  documented in COMMANDS (EN+KO), the guide (EN+KO), and the README config
  section.

## [1.2.0] — 2026-07-09

First post-GA feature release ("Smarter relay", roadmap v2.8). The v1.1.x
version numbers were consumed by the pre-GA "Distributable" tag line, so this
release is 1.2.0.

### Added
- **Opt-in handoff trigger thresholds** — new `handoffTriggers` config
  (`budgetRatio` / `changedFiles` / `usageTokensProxy`): when reached after a
  clean agent exit, relay-baton *suggests* handing off to the next agent
  (y/N confirm, or `--yes`). Absent config = unchanged error-pattern-only
  detection.
- **`run --handoff-now`** — manual trigger that relays to the next agent after
  each hop without waiting for a fallback signal.
- **Advisory routing hints** — agents carry `strengths` keyword tags; `run`
  prints a one-line chain suggestion when the task matches a different order.
  Display only; `--chain`/`--primary` always win.

### Improved
- Friendly CLI output (✓/✗/▲ symbols, "what to try next" hints, hop headings);
  colors auto-disable when piped or `NO_COLOR` is set.
- Warm desktop restyle (cream/warm-dark themes, terracotta accent, sans-serif
  chrome, message-card timeline). Display-only.

### Fixed
- `run` confirmation prompts auto-decline instead of hanging when stdin is not
  a TTY (CI/piped input).
- Windows CI: worktree test path comparison expands 8.3 short paths.

## [1.0.0] — 2026-06-22

First public, generally-available release. relay-baton graduates off the
perpetual `-alpha.N` line. No feature changes versus `2.6.0-alpha.0`; this
release makes the project legally usable and installable.

### Added
- **MIT `LICENSE`** at the repository root (previously unlicensed / "all rights
  reserved"). `license: "MIT"` declared in every package manifest.
- **npm distribution** — published under the `@relay-baton` scope:
  **`@relay-baton/cli`** (the CLI; unscoped `relay-baton` / `relaybaton` were
  blocked by npm — taken / too-similar), plus the `@relay-baton/core`,
  `@relay-baton/shared`, and `@relay-baton/tui` libraries, all public. The CLI
  installs the familiar `relay-baton` command, so `npm i -g @relay-baton/cli` /
  `npx @relay-baton/cli` work without a clone or build.
- **`CHANGELOG.md`** (this file), derived from `release-notes/`.
- README: npm-based quickstart path alongside the from-source flow.

### Changed
- All packages versioned to **1.0.0**; CLI `--version` reports `1.0.0`.

### Hard constraints (unchanged, locked by tests)
- No direct OpenAI/Anthropic API calls; subprocess-only via the local
  `codex` / `claude` CLIs.
- No storing/printing API keys; provider key env vars blocked by default.
- No auto commit/push/PR; no daemon; deterministic compaction only.

## Pre-1.0 history (alpha line)

Condensed; see `release-notes/` for the full notes of each tag.

- **2.6** — Multi-session workspace: named work items, per-agent assignment,
  safe parallelism via git worktrees.
- **2.5** — Guarded automation & extensibility: bounded `run --until <n>`,
  project recipes/hooks. Never an unattended daemon.
- **2.4** — Smarter handoff: deterministic compaction v2 (symbol-aware repo map,
  relevance-ranked diff) + local usage ledger (`relay-baton usage`).
- **2.3** — Multi-agent breadth: central agent registry, OpenCode/Gemini/Aider
  supported + Cursor CLI, N-way & reverse relay (`run --chain`).
- **2.2** — Trust & supply chain: path-traversal-safe `inspect`, signed releases
  + SLSA provenance, pinned actions + Dependabot + SBOM diff.
- **2.1** — Reliability & secret safety: Windows-safe agent spawn, redact-before-
  handoff gate, secret-leak regression scan.
- **2.0** — Stable desktop + local handoff platform: stable artifact schema v2 +
  `migrate`, public docs pass, hard constraints reaffirmed by tests.
- **1.9** — Team handoff package: portable `handoff bundle`/`inspect`, redaction
  pass, markdown `report`, desktop export.
- **1.8** — Project intelligence: `workspace`, `profile`, `inventory`, desktop
  project inspector.
- **1.7** — Guarded execution workflow: `checkpoint`, `guard`, `risk`, receipts.
- **1.6** — Session archives & recovery: `session archive|list|inspect|resume|
  prune`, integrity checks.
- **1.5** — Git tracking & session insight: read-only git snapshots, session
  baselines, review/handoff git context.
- **1.4** — Distribution polish: signing/notarization hooks, installers, package
  manifests, checksums, SBOM, desktop updater.
- **1.3** — Desktop conversation + project-scoped sessions.
- **1.2** — Desktop GUI (Tauri sidecar over the CLI).
- **1.1** — Distributable: standalone single-file executables per OS, automated
  GitHub Release pipeline.
- **1.0** — Stable Local Release: frozen config/session contracts, full command
  reference + i18n parity.
- **0.1 – 0.9** — MVP through bounded automation: Codex→Claude handoff, token
  diet, fallback detection, project registry, TUI, plan/execute, trust/verify,
  review/diagnose, adapter expansion + Agent Room.

[1.3.1]: https://github.com/dgl1231/relay-baton/releases/tag/v1.3.1
[1.3.0]: https://github.com/dgl1231/relay-baton/releases/tag/v1.3.0
[1.2.0]: https://github.com/dgl1231/relay-baton/releases/tag/v1.2.0
[1.0.0]: https://github.com/dgl1231/relay-baton/releases/tag/v1.0.0
