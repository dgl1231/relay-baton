# relay-baton Roadmap

relay-baton is a local handoff + token-diet harness that lets Codex CLI and
Claude Code take turns on the same repository without pasting whole logs,
diffs, or repos between them.

This roadmap is directional, not a contract. Versions ship when their theme is
solid; items can slip forward. Hard constraints never change: **no direct
OpenAI/Anthropic API calls, no storing/printing API keys, no auto
commit/push/PR, deterministic compaction only.**

## Shipped

- **v0.1** — MVP: Codex→Claude handoff, token diet, fallback detection, session
  files, quality gates, auth-safe subprocess execution.
- **v0.2** — Project registry, project-aware commands, TUI dashboard.
- **v0.3** — Side-effect-free resolver, registry recovery, env override.
- **v0.4** — GitHub Actions CI, critical-path tests, CLI smoke test, session
  observability, `handoff history`.
- **v0.5** — Plan-execute mode (`plan` / `execute`, planner→executor,
  PlanQualityGate) + context-compression mode (`compress-context`).
- **v0.6** — Trust & Verify: `verify`, `doctor --deep`, TUI mode panel.
- **v0.7** — Review & Diagnose: `review`, execution receipts, plan diffing,
  `--json` for status/budget/review, conversation event schema (draft).
- **v0.8** — Adapter expansion (OpenCode/Gemini/Aider scaffolds), CI OS matrix,
  Agent Room / conversation mode (first cut).
- **v0.9** — Bounded automation: plan↔execute loop, adaptive compression,
  `/continue --max-steps`, session replay.
- **v1.0** — Stable Local Release: frozen config/session contracts, full command
  reference + i18n parity, artifact stability guarantees, complete doctor/verify.
- **v1.1** — Distributable: standalone single-file executables per OS, automated
  GitHub Release pipeline, README downloads, Tauri desktop shell (scaffold).

## v1.1 — Distributable (current)

Make relay-baton something you **download and run**, not only something you
build. The CLI stays the engine; new surfaces are thin shells over it.

- [x] **Standalone executables** — single-file binaries for linux-x64 /
  macos-arm64 / windows-x64 built with Node SEA (no runtime install needed).
  Bundling (esbuild) and injection (postject) run via `npx` so the repo lockfile
  and the build/test CI stay untouched. See [`bin/sea-config.json`](../bin/sea-config.json).
- [x] **Release pipeline** — [`.github/workflows/release.yml`](../.github/workflows/release.yml)
  builds the matrix on every `v*` tag and attaches the binaries to the GitHub
  Release (default `GITHUB_TOKEN` only; no npm publish, no secrets).
- [x] **Per-release downloads in the README** — direct "latest release" links so
  users grab the binary for their OS.
- [x] **Tauri desktop shell (scaffold)** — `desktop/` (outside the pnpm
  workspace) wraps the CLI as a Tauri **sidecar**; the webview calls
  `relay-baton status/budget --json`. No logic duplicated; all hard constraints
  intact. Full GUI is v1.2.

## v1.2 — Desktop GUI

Grow the scaffold into a real, distributable desktop app — the "opencode /
Claude Code-style UI" without re-implementing any engine logic.

- [ ] Bundle the desktop app in the Release pipeline (Tauri build job consuming
  the same SEA sidecar binaries) → per-release `.dmg` / `.msi` / `.AppImage`.
- [ ] Project switcher + diet selector + budget panel (mirrors the Ink TUI,
  display-first).
- [ ] Handoff preview pane (renders `.ai-session/handoff.md` read-only).
- [ ] Agent Room view — confirmation-first, prompt preview before any real run
  (same safety model as the CLI room; never an autopilot).
- [ ] Code-signing / notarization story documented (binaries ship ad-hoc-signed
  until then).

## v1.3 — Distribution polish

- [ ] One-line installers (`install.sh` / `install.ps1`) that fetch the latest
  release binary and put it on PATH.
- [ ] Optional Homebrew tap / Scoop manifest (community-maintainable).
- [ ] Auto-update channel for the desktop app (Tauri updater, opt-in).
- [ ] SBOM + checksums attached to each release.

## v0.6 — Trust & Verify

Make the existing pipeline provable and observable before adding surface area.

- `doctor --deep` — extended environment diagnostics (tool versions, adapter
  args sanity, deprecated-arg warnings, CRLF/.gitattributes hints, registry +
  `.ai-session` health, latest handoff budget / plan / compression status).
- `verify` — simulated end-to-end pass with **no real model calls**: repo
  resolution, fallback detection, handoff no-run, token budget, API-key env
  block. `--real-agents` is scaffold only.
- TUI mode panel — display current mode, plan status, compression status, and
  latest handoff (display only; the TUI never launches agents).
- Docs — README plan/execute/compress-context workflow, this roadmap,
  consolidated verification commands.

## v0.7 — Review & Diagnose

Help the human (and the next agent) understand what changed and why.

- `review` — deterministic summary of the current diff against the plan /
  handoff (no model call): which plan Steps are touched, which are untouched.
- Plan execution receipts — executor marks `plan.md` Steps `[done]`/`[skipped]`
  (append-only markers, never rewriting step text).
- Plan diffing — re-plan shows a delta against the previous `plan.md` instead
  of a full rewrite; prior kept as `plan.<ts>.md`.
- Richer `status` / `budget` output and machine-readable (`--json`) variants.
- **Conversation event schema (draft)** — design the append-only event log
  (`.ai-session/conversation.jsonl`) that future versions use to record who
  said/did what (user / claude / codex / relay-baton). Documentation + draft
  types only; no chat command this version. See
  [`docs/AGENT_ROOM.md`](./AGENT_ROOM.md).
- **`review`/`diagnose` as conversation events** — document the direction that
  review/diagnose results are persisted as conversation events so the eventual
  Agent Room can replay them. Direction doc only this version.

## v0.8 — Adapter Expansion + Agent Room (first cut)

Grow beyond Codex/Claude only when a real user needs it, and stand up the
first interactive multi-agent "room".

- [x] OpenCode / Gemini / Aider adapter scaffolds — each is `<Name>Adapter.ts`
  + a mirror test + a README row.
- [x] Project-level fallback-pattern overrides (`BatonProject.fallbackPatterns?`
  overlays global via `resolveFallbackPatterns`).
- [x] macOS / Windows / Ubuntu CI matrix (`matrix.os`).
- [x] **Agent Room / Conversation Mode (first implementation)** — see
  [`docs/AGENT_ROOM.md`](./AGENT_ROOM.md):
  - [x] `relay-baton chat` (alias `relay-baton room`) entry point — a
    **turn-based, confirmation-first CLI REPL** (not a realtime platform; the
    Ink TUI stays display-only).
  - [x] Distinct, labeled messages for **user / claude / codex / relay-baton**,
    logged to `conversation.jsonl`.
  - [x] Claude as planner/reviewer, Codex as executor.
  - [x] Slash commands: `/agent claude|codex`, `/plan`, `/execute`, `/review`,
    `/handoff`, `/budget`, `/status`, `/help`, `/exit`.
  - [x] **Confirmation-first by default**, with a **prompt preview before any
    real agent run**.
  - [ ] Conversation+context **TUI panel** layout (§5 of AGENT_ROOM) — deferred.

## v0.9 — Automation & Runtime

Carefully add bounded automation while keeping the safety rails.

- [x] Multi-turn plan↔execute loop with a budget guard (`LoopController`:
  capped iterations, stop on `budget`/`divergence`/`explicit-stop`).
- [x] Adaptive per-agent compression thresholds
  (`contextCompression.perAgent`, `resolveCompressionThreshold`).
- [x] **Agent Room + bounded continue** — wired into bounded automation
  (see [`docs/AGENT_ROOM.md`](./AGENT_ROOM.md)):
  - [x] `/continue --max-steps N` (bounded, never unbounded autopilot).
  - [x] `/replan` from inside the room (backs up the current plan).
  - [x] Session replay from `conversation.jsonl` (`relay-baton replay`,
    room `/replay`).
- [ ] Optional non-interactive `run --until` orchestration — deferred candidate
  (still no auto-commit/push/PR; still subprocess-only).
- [ ] Cross-session archiving — deferred.
- [ ] A daemon prototype remains a *candidate*, not a commitment — **deferred /
  out of scope for now**.

## v1.0 — Stable Local Release

- [x] Frozen, documented config schema and SessionMeta contract
  (`CONFIG_VERSION` / `SESSION_SCHEMA_VERSION`, `validateConfig` /
  `validateSessionMeta` + normalizers).
- [x] Full command reference + i18n parity (`docs/COMMANDS.md` EN + KO).
- [x] Stability/compatibility guarantees for `.ai-session/` artifacts
  (`validateArtifacts`, `docs/ARTIFACTS.md`, wired into `doctor --deep`).
- [x] A complete `doctor`/`verify` health story (config + artifact contract
  checks in `doctor --deep`).
- [x] **Stable, project-aware Agent Room workflow** (see
  [`docs/AGENT_ROOM.md`](./AGENT_ROOM.md)):
  - [x] Safe handoff / run / plan / execute / review / diagnose / replay flow
    inside the room, each read-only or confirmation-first.
  - [ ] Demo gif / screenshots — deferred (cannot be produced deterministically).
  - [ ] Real-agent end-to-end documentation — deferred (`verify --real-agents`
    stays scaffold-only).

## Permanently out of scope

- Direct LLM API client / self-hosted inference.
- Auto commit / push / PR.
- Real-time agent chat / DM platform.
- IDE extensions, daemons, tmux managers.
- Semantic summarization or exact tokenizers (deterministic compaction only).
