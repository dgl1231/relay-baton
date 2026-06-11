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
- **v1.2** — Desktop GUI: project switcher/management, status/budget/handoff
  panels, Agent Room preview surface, desktop i18n.
- **v1.3** — Desktop conversation + project-scoped sessions: Agent Room composer,
  project/session context, slash-command checks.
- **v1.4** — Distribution polish: optional signing/notarization hooks, desktop
  agent switcher, installers, package-manager manifests, checksums, SBOM.
- **v1.5** — Git tracking & session insight: read-only git status snapshots,
  session baselines, review/status/handoff git context.

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

## v1.2 — Desktop GUI (shipped)

Grow the `desktop/` scaffold into a real, distributable desktop app — the
"opencode / Claude Code-style UI" — **without re-implementing any engine logic**.
The webview only ever calls the CLI sidecar; all business logic stays in
`packages/core`. Same hard constraints as everywhere else: subprocess-only,
read-only or confirmation-first, no auto commit/push/PR.

Phased so each phase is shippable on its own.

### Phase A — make it build & ship (foundation)

- [~] **`desktop/` builds locally.** `desktop/package.json` pins
  `@tauri-apps/cli` as a dev dep with `dev`/`build`/`icon` scripts (no global
  `cargo tauri` needed); README build section updated. Real icons now generate
  deterministically: `npm run gen-icon-source` (pure-Node PNG writer →
  `icon-source.png`, committed) + `npm run icon` (full per-OS set, gitignored,
  regenerated in CI). **Remaining (needs a Rust toolchain machine):** confirm
  `npm run dev` opens the window + the sidecar calls succeed.
- [x] **Sidecar staging script** — [`desktop/scripts/stage-sidecar.mjs`](../desktop/scripts/stage-sidecar.mjs)
  (`npm run stage-sidecar`) maps a Release artifact / local SEA binary to the
  Tauri target-triple name under `desktop/src-tauri/binaries/` and sets the
  Unix exec bit. Pure Node, cross-platform. See
  [`../desktop/src-tauri/binaries/README.md`](../desktop/src-tauri/binaries/README.md).
- [x] **Desktop release job** — [`release.yml`](../.github/workflows/release.yml)
  `build-desktop` job (needs `build-binaries`): downloads the SEA binary
  artifact, stages it as the sidecar, generates icons, runs `tauri build`
  per-OS, and attaches `.dmg` / `.msi` / `.AppImage` to the same GitHub
  Release. Unverified in CI until the next `v*` tag.
- [x] README: desktop installer table added next to the CLI binary table.

### Phase B — read-only dashboard (display-first, mirrors the Ink TUI)

> Implemented in `ui/index.html` + CLI; in-window verification shares the same
> Rust-toolchain blocker as Phase A item 1.

- [x] **Project switcher** — header dropdown fed by `project list --json` (new);
  switching calls the CLI's `project switch`, then refreshes all panels.
- [x] **Project management controls** — header controls can add projects through
  the native folder picker (`project add --json`) and remove the selected
  project with an explicit confirmation (`project remove --json`). The webview
  still goes through the CLI sidecar only.
- [x] **Status + budget panels** — parsed key/value panels with a budget usage
  bar (`status --json`, `budget --json`); errors render in-panel.
- [x] **Diet selector** — off/lite/balanced/caveman/ultra dropdown; UI state
  only (localStorage), passed through to future confirmed agent actions
  (Phase C) — no logic in the UI.
- [x] **Handoff preview pane** — renders the current handoff read-only via the
  new `handoff show --json` (the UI never touches `.ai-session/` directly).

### Phase C — Agent Room view (confirmation-first, never autopilot)

> Implemented in `ui/index.html`; in-window verification shares the same
> Rust-toolchain blocker as Phase A item 1.

- [x] **Conversation view** over `conversation.jsonl` — `replay --json` feeds a
  read-only timeline with color-labeled user / claude / codex / relay-baton
  roles, per-event kind + timestamp.
- [x] **Prompt preview before any real run** — a confirmation palette renders
  the exact `relay-baton …` command before anything happens. Read-only /
  no-model commands (`review`, `doctor --deep`, `status`) have a Run button;
  agent-launching commands (`plan`, `execute`, `handoff`) are copy-only — the
  GUI never spawns an agent (strongest reading of confirmation-first for the
  alpha). Bounded `/continue --max-steps` stays a CLI concern.
- [x] **Wire `/review` `/diagnose` `/plan` `/execute` `/handoff` as buttons** —
  present in the action palette; read-only ones execute via the sidecar,
  mutating ones preview the command to run in the terminal.

### Phase D — signing & polish

> Implemented; the Tauri-side bits (window-state plugin) share the same
> Rust-toolchain verification blocker as Phase A item 1.

- [x] **Code-signing / notarization story documented** — `RELEASE.md` "Code
  signing & notarization": current ad-hoc/unsigned state, the Gatekeeper /
  SmartScreen workarounds, and the path to real certs (Apple notarytool /
  Windows Authenticode) when secrets exist.
- [x] **Window state persistence, dark/light, keyboard shortcuts** — added
  `tauri-plugin-window-state` (remembers size/position); a persisted light/dark
  theme toggle (CSS variables, `localStorage`); and keyboard shortcuts
  mirroring the Ink TUI keys (`r` refresh, `p` next project, `d` cycle diet,
  `b` budget, `h` handoff, `t` theme, `q` quit, `?` help overlay).
- [x] **Desktop UI i18n** — header, buttons, panels, help overlay, empty states,
  and confirmation copy switch between English (default), Korean, Japanese, and
  Simplified Chinese via dependency-free strings in `ui/index.html`. CLI output
  remains untranslated.

**Definition of done for v1.2:** a user can download a desktop app from the
release page, open it, switch projects, see status/budget/handoff, and trigger a
confirmation-first agent run — all through the CLI sidecar, zero duplicated logic.

## v1.3 — Desktop conversation + project-scoped sessions

Bring the CLI Agent Room workflow into the desktop app without weakening the
safety model. The current desktop timeline is read-only (`replay --json`); v1.3
should add a composer/check surface while keeping the CLI/core as the source of
truth. See [`TASK-v1.3-desktop-chat-sessions.md`](./TASK-v1.3-desktop-chat-sessions.md).

- [x] **Desktop conversation composer (first cut)** — add an input area under the Agent Room
  timeline for slash-command style checks (`/status`, `/budget`, `/review`,
  `/diagnose`, `/replay`) and clearly marked preview/confirm actions for agent-
  launching commands (`/plan`, `/execute`, `/handoff`).
- [x] **Project-scoped session context (first cut)** — make the active project/session
  explicit in the conversation panel and refresh status, budget, handoff, and
  timeline when the project changes.
- [x] **CLI JSON/session surfaces where needed** — add small, tested CLI JSON
  commands instead of letting the webview read/write `.ai-session/` directly.
- [x] **i18n parity for new desktop chrome** — all new labels, empty states,
  confirmation text, and command hints support `en`, `ko`, `ja`, `zh`.
- [x] **Preserve hard constraints** — sidecar-only, confirmation-first, no
  direct LLM API calls, no API-key storage, no auto commit/push/PR, no daemon.

## v1.4 — Distribution polish & hardening

Make the (currently prerelease) builds trustworthy and effortless to install.
Full work order: [`TASK-v1.4-distribution.md`](./TASK-v1.4-distribution.md).

- [x] **Promote v1.3.0 stable** — superseded by later desktop release trains:
  v1.4/v1.5 tags have shipped from `main` with passing release workflows. A
  separate backfilled `v1.3.0` stable tag is no longer useful; keep real-window
  QA as the check before any future non-alpha desktop tag.
- [x] **Code signing & notarization hooks** — sign the Windows `.msi` (Azure Trusted
  Signing or an EV cert) and notarize the macOS `.dmg` (Developer ID +
  `notarytool`) when secrets are present. CI is wired as optional so unsigned
  builds keep working. Actual trusted output still needs paid certs/secrets.
- [x] **Desktop agent switcher (Codex ↔ Claude)** — a header toggle/button that
  picks which agent the Agent Room addresses, mirroring the CLI room's
  `/agent <claude|codex>`. Display + pass-through only: it sets the agent for
  the previewed `/plan` `/execute` `/handoff --to` commands; it never launches
  an agent from the GUI. Persisted like the diet selector; i18n in en/ko/ja/zh.
- [x] One-line installers (`install.sh` / `install.ps1`) that fetch the latest
  release binary and put it on PATH.
- [x] Optional Homebrew tap / Scoop manifest (community-maintainable).
- [x] Auto-update channel for the desktop app (Tauri updater, opt-in).
- [x] SBOM + checksums (SHA-256) attached to each release.

## v1.5 — Git tracking & session insight

Make relay-baton show the human what changed while an agent session is running,
without ever performing git writes. Full work order:
[`TASK-v1.5-git-tracking.md`](./TASK-v1.5-git-tracking.md).

- [x] **Read-only git status snapshot (first cut)** — core `GitService.summary`,
  `relay-baton git status --json`, desktop Git dashboard panel, and `/git` in
  the Agent Room. Non-git projects report `available:false` instead of failing.
- [x] **Session baseline snapshot** — record branch/HEAD/dirty state at session
  start and show whether the working tree changed since then.
- [x] **Review/handoff integration** — include bounded git tracking fields in
  review/status/handoff surfaces while keeping full diffs as file references.

## v1.6 — Session archives & recovery

Make relay-baton better at preserving completed work and resuming interrupted
work, especially across multiple projects and desktop sessions.

- [ ] **Session archive command** — `relay-baton session archive` packages the
  bounded `.ai-session/` artifacts into a timestamped archive under a local
  relay-baton data directory. Keep source files untouched.
- [ ] **Session list/open/export** — CLI JSON surfaces for recent sessions by
  project, plus desktop panels to browse and export them.
- [ ] **Resume diagnostics** — detect stale, incomplete, or mismatched session
  artifacts and suggest the safest next command (`status`, `review`, `handoff`,
  `replay`, or `verify`).
- [ ] **Prune policy** — configurable retention by age/count, disabled by
  default, with dry-run output first.
- [ ] **Archive integrity checks** — checksum manifest for archived artifacts;
  never include secrets or full dependency folders.

## v1.7 — Guarded execution workflow

Tighten the plan/execute loop so longer agent work remains auditable without
turning relay-baton into autopilot.

- [ ] **Execution checkpoints** — append-only checkpoints after each bounded
  execute step: command preview, changed files, git summary, budget, result.
- [ ] **Stop-condition policy** — project-configurable caps for max steps,
  max changed files, max budget, and required human confirmation.
- [ ] **Risk classifier (deterministic)** — flag risky surfaces such as package
  installs, file deletion, release edits, env/config changes, and generated
  binary changes. No model calls.
- [ ] **Desktop checkpoint view** — show the current step, last result, and
  blocked reason; mutating agent commands remain preview/copy-first.
- [ ] **Better receipts** — compact execution receipts suitable for handoff,
  archive, and review.

## v1.8 — Project intelligence & workspace map

Improve repo understanding with deterministic, bounded metadata so handoffs are
more useful without pasting the whole repository.

- [ ] **Workspace map v2** — detect package managers, app entry points, test
  commands, build commands, docs, AGENTS files, and likely ownership boundaries.
- [ ] **Project profile hints** — optional per-project hints for command
  defaults, excluded paths, language/framework tags, and preferred verification.
- [ ] **Dependency and script inventory** — bounded summaries of package scripts,
  workspace packages, CI workflows, and release files.
- [ ] **Desktop project inspector** — read-only view of repo map, configured
  commands, current session artifacts, and git tracking.
- [ ] **No semantic indexing yet** — keep this deterministic; embeddings,
  vector stores, and exact tokenizers remain out of scope.

## v1.9 — Team handoff package

Make relay-baton artifacts easier to share with another human or another local
agent setup while preserving the local-only safety model.

- [ ] **Portable handoff bundle** — `relay-baton handoff bundle` creates a
  small archive containing handoff, compact state, repo map, receipts, git
  summary, and referenced artifacts.
- [ ] **Import/inspect bundle** — validate a bundle and print what it contains
  without applying changes.
- [ ] **Redaction pass** — deterministic checks for obvious secrets, absolute
  home paths, API keys, and oversized logs before export.
- [ ] **Markdown report** — human-readable status report for PR comments,
  issue updates, or team chat, generated from existing artifacts only.
- [ ] **Desktop export flow** — export/copy bundle/report from the project
  session view; no cloud upload.

## v2.0 — Stable desktop + local handoff platform

Define the next stability line: relay-baton remains local-first, subprocess-only,
and deterministic, but the desktop app becomes a first-class daily workflow
instead of a thin release shell.

- [ ] **Stable desktop contract** — desktop UI covers project management,
  status/budget, git tracking, session archives, replay, handoff preview, and
  guarded command preview with i18n parity.
- [ ] **Stable artifact schema v2** — versioned contracts for session archives,
  checkpoints, git baselines, handoff bundles, and conversation events.
- [ ] **Upgrade/migration checks** — `doctor --deep` detects old artifact
  schemas and provides safe migration or read-only compatibility guidance.
- [ ] **Installer/update story finalized** — signed builds when credentials
  exist, checksums/SBOM always, and opt-in desktop update channel if the updater
  has proven reliable.
- [ ] **Public docs pass** — docs for install, quickstart, desktop workflow,
  CLI workflow, project registry, session archive, git tracking, and safety
  model are complete in English and Korean.
- [ ] **Hard constraints reaffirmed** — no direct LLM API client, no API-key
  storage, no auto commit/push/PR, no daemon requirement, no real-time chat
  platform, no semantic/vector indexing by default.

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
