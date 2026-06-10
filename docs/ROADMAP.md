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
  Shipped on tag `v1.1.3` (v1.1.0–1.1.2 were release-pipeline hotfixes; see
  [`RELEASE.md`](./RELEASE.md) gotchas).

## v1.1 — Distributable (shipped, v1.1.3)

Make relay-baton something you **download and run**, not only something you
build. The CLI stays the engine; new surfaces are thin shells over it.

> ✅ **Done.** The `v1.1.3` Release carries working `relay-baton-linux-x64`,
> `relay-baton-macos-arm64`, `relay-baton-windows-x64.exe`. Operational details
> and the four hard-won CI gotchas live in [`RELEASE.md`](./RELEASE.md).

- [x] **Standalone executables** — single-file binaries for linux-x64 /
  macos-arm64 / windows-x64 built with Node SEA (no runtime install needed).
  Bundling (esbuild) and injection (postject) use globally-installed, version-
  pinned tools so the repo lockfile and the build/test CI stay untouched. See
  [`bin/sea-config.json`](../bin/sea-config.json) and [`RELEASE.md`](./RELEASE.md).
- [x] **Release pipeline** — [`.github/workflows/release.yml`](../.github/workflows/release.yml)
  builds the matrix on every `v*` tag and attaches the binaries to the GitHub
  Release (default `GITHUB_TOKEN` only; no npm publish, no secrets).
- [x] **Per-release downloads in the README** — direct "latest release" links so
  users grab the binary for their OS.
- [x] **Tauri desktop shell (scaffold)** — `desktop/` (outside the pnpm
  workspace) wraps the CLI as a Tauri **sidecar**; the webview calls
  `relay-baton status/budget --json`. No logic duplicated; all hard constraints
  intact. Full GUI is v1.2.

## v1.2 — Desktop GUI (next)

Grow the `desktop/` scaffold into a real, distributable desktop app — the
"opencode / Claude Code-style UI" — **without re-implementing any engine logic**.
The webview only ever calls the CLI sidecar; all business logic stays in
`packages/core`. Same hard constraints as everywhere else: subprocess-only,
read-only or confirmation-first, no auto commit/push/PR.

Phased so each phase is shippable on its own.

### Phase A — make it build & ship (foundation)

- [~] **`desktop/` builds locally.** `desktop/package.json` now pins
  `@tauri-apps/cli` as a dev dep with `dev`/`build`/`icon` scripts (so no global
  `cargo tauri` needed); README build section updated. **Still needs a Rust
  toolchain machine** to: generate real icons (`npm run icon -- <png>`) and
  confirm `npm run dev` opens the window + the sidecar calls succeed.
- [x] **Sidecar staging script** — [`desktop/scripts/stage-sidecar.mjs`](../desktop/scripts/stage-sidecar.mjs)
  (`npm run stage-sidecar`) maps a Release artifact / local SEA binary to the
  Tauri target-triple name under `desktop/src-tauri/binaries/` and sets the
  Unix exec bit. Pure Node, cross-platform. See
  [`../desktop/src-tauri/binaries/README.md`](../desktop/src-tauri/binaries/README.md).
- [ ] **Desktop release job** — extend [`release.yml`](../.github/workflows/release.yml)
  with a job that, after the SEA binaries exist, runs `tauri build` per-OS and
  attaches `.dmg` / `.msi` / `.AppImage` to the same GitHub Release.
- [ ] README: add desktop downloads next to the CLI binary table.

### Phase B — read-only dashboard (display-first, mirrors the Ink TUI)

- [ ] **Project switcher** — list registry projects, switch active (calls
  `project list` / `project switch`).
- [ ] **Status + budget panels** — already prototyped in `ui/index.html`; polish
  into real panels (`status --json`, `budget --json`).
- [ ] **Diet selector** — pick caveman/balanced/rich (display + pass-through to
  the next CLI call; no logic in the UI).
- [ ] **Handoff preview pane** — render the latest `.ai-session/handoff.md`
  read-only (via a CLI read command; never write from the UI).

### Phase C — Agent Room view (confirmation-first, never autopilot)

- [ ] **Conversation view** over `conversation.jsonl` (reuse `replay`) with the
  labeled user / claude / codex / relay-baton roles.
- [ ] **Prompt preview before any real run**, identical safety model to the CLI
  room — explicit confirm, bounded `/continue --max-steps`, no unbounded loop.
- [ ] Wire `/plan` `/execute` `/review` `/diagnose` `/handoff` as buttons that
  shell out to the same commands.

### Phase D — signing & polish

- [ ] **Code-signing / notarization story documented.** Until real certs exist,
  binaries ship ad-hoc-signed (macOS) / unsigned (Win) — document the Gatekeeper
  / SmartScreen workaround in `RELEASE.md`.
- [ ] Window state persistence, dark/light, basic keyboard shortcuts mirroring
  the TUI keys.

**Definition of done for v1.2:** a user can download a desktop app from the
release page, open it, switch projects, see status/budget/handoff, and trigger a
confirmation-first agent run — all through the CLI sidecar, zero duplicated logic.

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
