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

- [x] **Session archive command (first cut)** — `relay-baton session archive` packages the
  bounded `.ai-session/` artifacts into a timestamped archive under a local
  relay-baton data directory. Keep source files untouched. Directory archive
  only for now; zip/bundle UX remains follow-up.
- [x] **Session list/open/export** — `session list` / `inspect` (read-only,
  manifest+integrity), desktop archive panel (list + inspect + resume), and
  `session export <id> --to <dir>` to copy an archive out for sharing/backup.
- [x] **Resume diagnostics** — `relay-baton session resume [--json]` classifies
  the session as missing/incomplete/stale/ok from required-file presence,
  `session.json` validity, git baseline drift, and `updatedAt` age, then suggests
  the safest next command (`init`, `status`, `replay`, `review`, `handoff`,
  `session archive`). Read-only.
- [x] **Prune policy** — `relay-baton session prune [--max-age-days]
  [--max-count] [--apply]` applies retention by age/count, disabled by default
  and dry-run unless `--apply`. Never prunes by age when `createdAt` is unknown.
- [x] **Archive integrity checks** — `manifest.json` records per-file size +
  SHA-256; `session inspect` verifies presence/size/hash and flags
  missing/corrupt files. Documented + tested.

## v1.7 — Guarded execution workflow

Tighten the plan/execute loop so longer agent work remains auditable without
turning relay-baton into autopilot.

- [x] **Execution checkpoints** — `relay-baton checkpoint add <step>` appends an
  append-only JSON checkpoint per bounded execute step (command preview, changed
  files, git summary, budget, result) to `.ai-session/checkpoints.jsonl`;
  `checkpoint list` reads them back. Read-only snapshots, no model calls.
- [x] **Stop-condition policy** — `relay-baton guard [--json] [--exit-code]`
  evaluates project-configurable caps (`guardrails`: maxSteps, maxChangedFiles,
  maxBudgetRatio, requireConfirmation) against checkpoints + live git/budget.
  Deterministic, read-only, advisory — never auto-halts an agent.
- [x] **Risk classifier (deterministic)** — `relay-baton risk [--json]` flags
  risky surfaces from the git status (dependency manifests, file deletions,
  release/CI edits, env/config changes, binary artifacts) with category +
  severity. No model calls.
- [x] **Desktop checkpoint view** — dashboard "guarded execution" card (guard
  verdict + checkpoint receipt) and Agent Room `/checkpoints`, `/guard`, `/risk`,
  all read-only through the CLI sidecar.
- [x] **Better receipts** — `relay-baton checkpoint summary [--json]` derives a
  compact execution receipt (results breakdown, last step, max changed files,
  latest budget) suitable for handoff, archive, and review.

## v1.8 — Project intelligence & workspace map

Improve repo understanding with deterministic, bounded metadata so handoffs are
more useful without pasting the whole repository.

- [x] **Workspace map v2** — `relay-baton workspace [--json]` deterministically
  detects package managers, languages, monorepo packages, npm scripts
  (build/test/lint + others), entry points, docs, and AGENTS/CLAUDE files from
  manifest/config files. Bounded, read-only, no model calls.
- [x] **Project profile hints** — `relay-baton profile [--json]` derives
  framework tags, recommended build/test commands, diet/agent defaults, excluded
  paths, and entry points from the workspace map + config + project defaults.
- [x] **Dependency and script inventory** — `relay-baton inventory [--json]`
  gives bounded summaries of package scripts, workspace packages, CI workflows,
  and release files.
- [x] **Desktop project inspector** — dashboard "project inspector" card
  (workspace + profile) and Agent Room `/workspace`, `/profile`, `/inventory`,
  all read-only through the CLI sidecar.
- [ ] **No semantic indexing yet** — keep this deterministic; embeddings,
  vector stores, and exact tokenizers remain out of scope.

## v1.9 — Team handoff package

Make relay-baton artifacts easier to share with another human or another local
agent setup while preserving the local-only safety model.

- [x] **Portable handoff bundle** — `relay-baton handoff bundle` packages curated
  artifacts (handoff, compact state, repo map, plan/receipts, decisions, changed
  files, test results, errors, session.json) plus a git summary into a
  timestamped bundle with `manifest.json` (size + SHA-256).
- [x] **Import/inspect bundle** — `relay-baton handoff inspect <bundle>`
  validates manifest shape + per-file integrity and prints contents; applies
  nothing.
- [x] **Redaction pass** — deterministic scan for obvious secrets, API keys,
  absolute home paths, and oversized files, written to `redaction.json` in the
  bundle and surfaced on `handoff bundle`.
- [x] **Markdown report** — `relay-baton report` renders a human-readable status
  report (task/status/git/checkpoints/handoff excerpt) from existing artifacts
  only.
- [x] **Desktop export flow** — "team handoff" card (build bundle, copy report)
  plus Agent Room `/bundle`, `/report`; no cloud upload, sidecar only.

## v2.0 — Stable desktop + local handoff platform

Define the next stability line: relay-baton remains local-first, subprocess-only,
and deterministic, but the desktop app becomes a first-class daily workflow
instead of a thin release shell.

- [x] **Stable desktop contract** — desktop UI covers project management,
  status/budget, git tracking, session archives, replay, handoff preview, guarded
  execution, project inspector, and team handoff. i18n parity (en/ko/ja/zh) is
  now enforced by an automated test (`desktopI18n.test.ts`).
- [x] **Stable artifact schema v2** — `ARTIFACT_SCHEMA_VERSIONS` registry +
  `relay-baton migrate --apply [--dry-run]` (legacy normalization, timestamped
  backups, idempotent). Versioned-contract coverage spans `session.json`,
  `checkpoints.jsonl`, `git-baseline.json`, and `conversation.jsonl`; archive and
  bundle manifests carry `schemaVersion`. Future per-artifact version *bumps*
  plug version-to-version migrators into the same registry as breaking changes
  require them.
- [x] **Upgrade/migration checks** — `relay-baton migrate --check` /
  `doctor --deep` detect each versioned artifact's schema (ok/outdated/ahead/
  legacy/unreadable) via `ARTIFACT_SCHEMA_VERSIONS`; `migrate --apply` normalizes
  legacy artifacts (backup + dry-run). Version-to-version migrators plug in when
  a schema is bumped.
- [x] **Installer/update story finalized** — finalized distribution policy
  documented in `RELEASE.md`: always-on CLI binaries + desktop installers +
  `SHA256SUMS` + SBOM, conditional signing (macOS/Windows) and the opt-in,
  manual desktop updater channel when secrets exist. One-line installers verify
  `SHA256SUMS`. Locked by a docs test.
- [x] **Public docs pass** — consolidated `docs/GUIDE.md` (EN) +
  `docs/i18n/GUIDE.ko.md` (KO) cover install, quickstart, desktop + CLI
  workflows, project registry, artifacts/schema, and the safety model, linked
  from the README and covered by a docs test. `<your-org>` placeholders fixed.
- [x] **Hard constraints reaffirmed** — auth policy (blocked provider key env
  vars, `allowApiKeyEnv` off, cli-session mode) and "no direct LLM API client
  dependency" are locked by an automated test (`hardConstraints.test.ts`). The
  remaining constraints (no auto commit/push/PR, no daemon, no real-time chat,
  no default semantic indexing) hold by design and are documented.

## Beyond v2.0 — proposed line (v2.1 → v2.8)

The v1.x → v2.0 lines are complete. The next stable line is sequenced
hardening-first (security/reliability before new surface area), then capability
breadth, a multi-session workspace (v2.6), and finally **v2.7 — public release &
distribution (GA)**, which removes
the non-feature blockers (license, npm/package-manager install, code signing) to
a real public launch. Every item respects the existing hard constraints
(local-first, subprocess-only, deterministic, no direct LLM API client, no auto
commit/push/PR, no daemon requirement, no default semantic/vector indexing).
Proposed only — nothing committed; cut as alpha increments like v2.0.

### v2.1 — Reliability & secret safety

Fix real local-execution bugs and make sure secrets never leave the machine.

- [x] **Windows agent spawn reliability** — agent spawns now route through a
  `safeSpawn` wrapper (cross-spawn): it resolves npm-global `.cmd`/`.bat` shims
  via PATH+PATHEXT and runs them through `cmd.exe` with escaped arguments and
  `shell:false`, fixing the ENOENT/EINVAL that made `doctor` mis-report agents as
  missing. Applied to AgentRunner, all five adapters, `doctor`, `login`, and the
  TUI. Injection-safe (verified by test).
- [x] **Redact before handoff, not just bundle** — `buildHandoff` scans the
  generated handoff (what the next agent reads) with `RedactionScanner`; `run` and
  `handoff` enforce a **Redaction Gate** that blocks launching the next agent on
  high-severity findings (secrets/keys/private keys) unless `--force`, and warns
  on medium ones (home paths, oversized).
- [x] **Secret-leak regression scan** — `secretLeak.test.ts` asserts provider key
  env vars are stripped from the child by default (values can't reach the agent or
  its logs) and that only *names* are recorded when allowed through. `run`/`handoff`
  emit an audit conversation event (names only) when `--allow-api-key-env` passes
  a key through; `createAgentEnv` now returns `passedThrough` for that audit.

### v2.2 — Trust & supply chain

Make releases and externally-received artifacts trustworthy.

- [x] **Untrusted-bundle / path-traversal safety** — `inspect` on a handoff
  bundle or session archive no longer trusts manifest `target` paths. A shared
  `resolveWithin` guard (`@relay-baton/shared`) rejects absolute targets, `..`
  escapes, and symlink escapes; a per-file size cap (`MAX_INSPECT_FILE_BYTES`,
  8 MiB) caps verification reads. Rejected entries land in a new `unsafe[]` list,
  each file carries `safe`/`unsafeReason`, and the result exposes a top-level
  `safe` flag (CLI prints `trust: safe|UNSAFE`). Bundler/archiver now emit
  bundle-relative POSIX targets so legitimate artifacts pass the guard.
- [x] **Signed releases + provenance by default** — `release.yml` now publishes
  SLSA build provenance for every CLI binary + `SHA256SUMS` via
  `actions/attest-build-provenance` using the default `GITHUB_TOKEN` (no extra
  secrets, so attestation is on by default). Consumers verify with
  `gh attestation verify <file> --repo dgl1231/relay-baton`. The existing
  secret-gated Azure/Apple/Tauri code signing remains for installers.
- [x] **Supply-chain hardening** — all GitHub Actions are pinned by commit SHA
  (with a trailing version comment) in `ci.yml` + `release.yml`;
  `.github/dependabot.yml` enables grouped weekly updates for npm (root +
  desktop), cargo (Tauri), and github-actions; and `release-finalize` runs
  `.github/scripts/sbom-diff.mjs` to diff the CycloneDX SBOM against the previous
  release (added/removed/changed components) and publish `sbom-diff.md`.

### v2.3 — Multi-agent breadth

Make relay-baton agent-agnostic beyond the Codex↔Claude pair.

- [x] **First-class multi-agent matrix** — a central agent registry
  (`packages/core/src/agents/AgentRegistry.ts`) is the single source of truth for
  every agent: tier (`first-class` codex/claude vs `supported`), install URL,
  login spec, default args, and agent-specific fallback patterns. OpenCode /
  Gemini / Aider are promoted from scaffolds to **supported** and **Cursor CLI**
  (`cursor-agent`) is added behind the same `AgentAdapter` contract. `login` is
  now registry-driven (per-agent install/login flows, incl. interactive and
  env-key agents); `doctor` reports availability + tier for all six agents;
  `ConfigSchema` and `diagnostics` derive their agent lists from the registry;
  and `run` merges the active agent's fallback patterns into the detector. Tests:
  `AgentRegistry.test.ts` (registry invariants + Cursor adapter).
- [x] **N-way & reverse relay** — `run` is now a generalized relay loop over an
  ordered agent chain instead of a hardcoded codex→claude pair. The deterministic
  "who's next" policy (`resolveChain`): `--chain a,b,c` wins, else
  `--primary`/`--fallback` → project overrides → config. Supports reverse
  (claude→codex) and longer N-way chains; each hop builds + gates a handoff and
  uses the active agent's fallback patterns. Continuation prompt is now
  agent-agnostic (`PromptBuilder.continuation`). Tests: `relayChain.test.ts`.

### v2.4 — Smarter handoff (still deterministic)

Spend fewer tokens per handoff without adding embeddings.

- [x] **Deterministic compaction v2** — `SymbolOutline` extracts a
  symbol/heading outline (TS/JS/PY/C#/Go/Rust/Java + Markdown headings) so the
  repo map carries a "## Symbols (changed + key files)" section, not just a tree.
  `DiffCompactor.compactRanked` ranks diff chunks by relevance to the task
  (path mention, directory proximity, source>test>doc weight, shallow-path bias)
  so the most relevant file diffs survive the budget first; `buildHandoff` uses
  it. Deterministic, no embeddings. Tests: `CompactionV2.test.ts`.
- [x] **Local usage insight** — `UsageLedger` keeps an append-only per-session
  ledger (`.ai-session/usage.jsonl`) of a token/quota *proxy* (`ceil(chars/4)`,
  not a real tokenizer); `run`/`handoff` record a handoff event each time.
  `relay-baton usage [--json]` aggregates totals, per-type/per-agent breakdown,
  handoff count, and a budget ratio vs the active profile. Local only — never
  transmitted. Tests: `UsageLedger.test.ts`.

### v2.5 — Guarded automation & extensibility

Longer unattended-but-bounded runs and per-project customization.

- [x] **Bounded auto-orchestration (`run --until <n>`)** — `BoundedOrchestrator`
  (core) combines `LoopController` (step cap / budget / divergence) with
  `GuardrailPolicy` (changed-file / step / budget caps) into one deterministic
  "may I take one more step?" decision. `run --until N` runs up to N extra
  continue-steps on the completing agent, **confirmation-first** (each step
  prompts unless `--yes`), recording a checkpoint + usage event per step. Strictly
  bounded — never an unattended daemon; removing the cap or confirmation gate is
  out of scope by design (respects CLAUDE.md "no autopilot"). Tests:
  `BoundedOrchestrator.test.ts`.
- [x] **Project recipes / hooks** — optional `hooks.preHandoff` / `hooks.postExecute`
  config arrays of shell commands run at lifecycle points by `HookRunner` (core).
  Local-only: env sanitized like an agent's (provider keys stripped by default),
  no daemon, no network; absent config = no-op; chain stops on first failure;
  output mirrored to `commands.log`. Wired into `run` and `handoff`. Tests:
  `HookRunner.test.ts`.

### v2.6 — Multi-session workspace (concurrent work items)

Today relay-baton is single-session per repo: one `.ai-session/`, one
`session.json` (one task, one active/last agent), and `run` overwrites it — so
you cannot track multiple AI tasks at once, nor pin a task to a specific agent.
This line unifies **per-agent session assignment** and **multi-tasking** into one
concept — a *named work item* — while keeping every hard constraint (local-first,
deterministic, no daemon, no real-time chat). Pulled in before GA.

- [x] **Named sessions (work-item registry)** — `WorkspaceManager` owns
  `.ai-session/workspace.json` (active pointer + work-item list). Named items live
  under `.ai-session/sessions/<name>/`; the legacy flat `.ai-session/` IS the
  `default` item, so existing repos need **zero migration**. `SessionFiles`
  resolves the active item, so all existing commands (`run`/`handoff`/`status`/
  `usage`/…) transparently operate on it. New CLI: `session new|switch|use|items|
  assign|remove`. Tests: `WorkspaceManager.test.ts`.
- [x] **Per-agent session assignment** — each work item carries an
  `assignedAgent` (`session new --agent` / `session assign <name> <agent>`).
  `run` uses it as the default primary in the relay chain (beats project/config
  defaults, loses to explicit `--primary`/`--chain`).
- [x] **Safe parallelism via git worktrees** — `GitService` gains
  `addWorktree`/`listWorktrees`/`removeWorktree`; `session worktree add|remove
  <name>` backs a work item with its own git worktree (default
  `<parent>/<repo>.worktrees/<name>`, branch `relay/<name>`), recorded as
  `worktree` on the item. When the active item has a worktree, `run` executes in
  that isolated checkout (own working tree + own `.ai-session`), so parallel work
  items never clobber each other's git state. The registry stays in the main
  repo; still confirmation-first, still no daemon. Tests: `GitWorktree.test.ts`.

### v2.7 — Public release & distribution (GA)

relay-baton is a **local CLI + desktop tool**, not a hosted service — "shipping"
means easy install, OS trust, and legal clarity, not infra/ops. The codebase is
already feature-mature; this milestone removes the non-feature blockers to a
public, real-user release. Sequenced in two phases: Phase 0 makes it legally
usable and installable without code-signing cost; Phase 1 removes install
friction; Phase 2 announces.

**Phase 0 — legal + installable (no signing cost):**

- [x] **LICENSE** — top-level `LICENSE` (MIT, © 2026 DongGeon Lee) added; repo
  was previously unlicensed ("all rights reserved"). `license: "MIT"` set in the
  root + all four package manifests, and `LICENSE` copied into each package dir
  so published tarballs are legally complete.
- [x] **npm distribution** — CLI package renamed `@relay-baton/cli` →
  unscoped **`relaybaton`** (the name `relay-baton` was already taken on npm by
  an unrelated package; the bin stays `relay-baton`, so `npm i -g relaybaton` /
  `npx relaybaton` install the familiar `relay-baton` command);
  `private: true` dropped on all four packages, each given
  `publishConfig.access:public`, `files`, `engines`, `repository`/`homepage`/
  `bugs`. `pnpm pack` verified `workspace:*` → `1.0.0` substitution. **Actual
  `npm publish` is a manual step** (needs the maintainer's npm login + the
  `@relay-baton` scope; publish via `pnpm -r publish`, not `npm publish`, so the
  workspace protocol is rewritten).
- [x] **GA versioning + CHANGELOG** — graduated off `-alpha.N` to **1.0.0**
  (root + 4 packages + CLI `--version`); added user-facing
  [`CHANGELOG.md`](../CHANGELOG.md) derived from `release-notes/`.
- [~] **Onboarding polish** — README prerequisites (codex + claude CLIs) +
  Logging-in section already present; added an npm-based 30-second quickstart and
  bumped the release badge. Added [`CONTRIBUTING.md`](../CONTRIBUTING.md) +
  GitHub issue templates (bug/feature + config with security link). **Remaining:**
  demo (asciinema/GIF) — cannot be produced deterministically, deferred.

**Phase 1 — remove install friction (cost / accounts):**

- [ ] **Code signing & notarization (default)** — turn on macOS notarization
  (Apple Developer account) and Windows signing (Azure Trusted Signing) so
  installers don't trip Gatekeeper / SmartScreen. Provenance (v2.2) proves supply
  chain but does NOT remove OS install warnings — that needs real signing.
- [ ] **Package managers** — ship a Homebrew tap, a Scoop bucket, and a Winget
  manifest, wired to the existing `SHA256SUMS` so they verify on install.

**Phase 2 — announce:**

- [ ] **Soft launch + announce** — dogfood + a small beta cohort for feedback,
  then a public announcement (Show HN, r/commandline, r/ClaudeAI, the Codex /
  Claude communities). No telemetry by default; respect the local-first contract.

### v2.8 — Smarter relay (proposed, post-GA)

Borrowed *narrowly* from orchestrator tools (Hermes / OpenCode) **without**
adopting their architecture. relay-baton stays a handoff/baton-touch harness, not
a resident judge-AI that routes work across models in real time. So no resident
orchestrator, no daemon, no direct LLM API calls — only deterministic,
confirmation-first improvements to *when* and *to whom* the baton passes.

> Explicitly NOT borrowed: a always-on "main judging AI" control loop, dynamic
> multi-agent collaboration, autopilot. Those spend tokens and break the auth +
> token-diet contracts; relay-baton's value is *cheap* session continuity, the
> opposite problem.

- [ ] **Broadened fallback triggers** — today fallback is detected only from an
  agent's usage/rate/quota error patterns. Add deterministic, opt-in triggers:
  a **manual** "hand off now" trigger (`run --handoff-now` / room command) and
  **threshold-based** triggers (budget ratio, `UsageLedger` token-proxy, or
  changed-files cap) that *suggest* a handoff. Still confirmation-first; never an
  unattended daemon. Reuses `GuardrailPolicy` caps + `UsageLedger`.
- [ ] **Deterministic routing hints (advisory only)** — `AgentRegistry` gains
  per-agent strength tags (e.g. planning vs. bulk-edit vs. review); given a task
  string, a deterministic keyword match *proposes* a chain ordering for
  `resolveChain`. Pure suggestion surfaced in the preview — the human still
  confirms, explicit `--chain`/`--primary` always wins. No model call, no
  auto-pick.

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
