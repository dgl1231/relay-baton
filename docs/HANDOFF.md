# Session Handoff — relay-baton

> Compact, deterministic handoff for the next session (possibly a fresh/cold
> agent on a different machine). This is the relay-baton concept applied to the
> project itself. Read this first, then `git pull`.
>
> **Keep this file alive:** update it after every meaningful chunk of work (and
> before ending a session) — bump `_Last updated:_`, refresh "Where we are" /
> "Next up", and record any new machine-specific gotchas. See `CLAUDE.md` →
> "세션 핸드오프 규칙".

_Last updated: 2026-06-23 — **v1.0.0 GA SHIPPED.** Public release done: npm
`@relay-baton/cli` + `core`/`shared`/`tui` all live @ 1.0.0 (under the
`@relay-baton` npm org; CLI is scoped because unscoped `relay-baton` is taken and
`relaybaton` was rejected as too-similar — bin stays `relay-baton`). GitHub
Release **v1.0.0** is public with CLI binaries + desktop installers + SBOM +
`SHA256SUMS` (release run `27925206710` green). The `v1.0.0` git tag was moved
off the old internal "Stable Local Release" milestone onto the GA commit. Fixed a
Windows-only CI failure (`GitWorktree.test.ts` 8.3 short-path compare → use
`fs.realpathSync.native`; main CI green on `42f7166`). Desktop version strings
aligned to 1.0.0 (`desktop/package.json`+lock, `tauri.conf.json`, `Cargo.toml`)
so the NEXT release's installers drop the stale `2.6.0` name. **Distribution is
fully live:** npm (`@relay-baton/cli` + libs), Homebrew tap, Scoop bucket, and
Winget (winget-pkgs#391897 merged) all install v1.0.0; release fan-out is
automated (`scripts/bump-version.mjs` + release.yml `publish-npm`/
`update-brew-scoop`/`update-winget` jobs, secrets configured). Remaining
post-GA: code signing (paid, user decision — Phase 1은 진행 안 하기로 함), demo
GIF, announce.

**2026-07-09 — v2.8 (Smarter relay) FEATURE-COMPLETE locally (not released).**
Both boxes `[x]`. Item 1: `HandoffTriggerPolicy` (core/plan) — opt-in
`handoffTriggers` config (`budgetRatio`/`changedFiles`/`usageTokensProxy`),
no-op when absent; `run --handoff-now` manual trigger (explicit consent);
threshold hits prompt y/N (or `--yes`) before relaying on a clean exit
(`relayReason` threading in `run.ts`). ConfigSchema validates the block. Item 2:
`AgentRegistry` entries gain `strengths` tags; `suggestChain` (core,
`RoutingHints.ts`) reorders the resolved chain by deterministic keyword match;
`run` prints an advisory hint only (suppressed by `--chain`/`--primary`). Tests:
`SmarterRelay.test.ts` (9). Build green, 313 core + 89 cli pass. Prior history
below._

_Earlier: 2026-06-16 — **v2.3 (Multi-agent breadth) FEATURE-COMPLETE locally
(not yet released).** Both boxes `[x]`. Item 1: central **agent registry**
(`packages/core/src/agents/AgentRegistry.ts`) — tier (first-class codex/claude vs
supported), install URL, login spec, default args, per-agent fallback patterns;
OpenCode/Gemini/Aider promoted scaffold→supported; **Cursor CLI** (`cursor-agent`)
added (`AgentId` gains `cursor`); registry-driven `login`; `doctor` shows all 6
agents + tier; `ConfigSchema`/`diagnostics` derive lists from the registry. Item
2: **N-way & reverse relay** — `run` is now a generalized relay loop over an
ordered chain (`resolveChain`: `--chain` > `--primary`/`--fallback` > project >
config); supports reverse (claude→codex) + longer chains; `PromptBuilder.
continuation()` is agent-agnostic. New tests `AgentRegistry.test.ts` +
`relayChain.test.ts`. SHIPPED & VERIFIED on `v2.3.0-alpha.0` (run `27602507471`).

**v2.4 (Smarter handoff) FEATURE-COMPLETE locally (not yet released).** Both
boxes `[x]`. Item 1 — deterministic compaction v2: `SymbolOutline` (TS/JS/PY/C#/
Go/Rust/Java + Markdown headings) feeds a "## Symbols" section in the repo map;
`DiffCompactor.compactRanked` ranks diff chunks by task/path proximity (used by
`buildHandoff`). Item 2 — local usage insight: `UsageLedger` append-only
`.ai-session/usage.jsonl` token proxy (`ceil(chars/4)`), recorded by
`run`/`handoff`; new `relay-baton usage [--json]` (totals, per-type/agent,
budget ratio). Local only, never transmitted. New `CompactionV2.test.ts` +
`UsageLedger.test.ts`. SHIPPED & VERIFIED on `v2.4.0-alpha.0` (run `27657546301`).

**v2.5 (Guarded automation & extensibility) FEATURE-COMPLETE locally (not yet
released).** Both boxes `[x]`. Item 1 — bounded auto-orchestration:
`BoundedOrchestrator` (core) = `LoopController` + `GuardrailPolicy`; `run --until
<n>` runs ≤N extra continue-steps on the completing agent, confirmation-first
(prompts unless `--yes`), checkpoint+usage per step. Strictly bounded, no daemon
(respects CLAUDE.md "no autopilot" — chosen "strict bounded" approach). Item 2 —
project recipes/hooks: optional `hooks.preHandoff`/`hooks.postExecute` config
arrays run by `HookRunner` (core), local-only, env-sanitized, no network, no-op
when absent, stop-on-first-failure; wired into `run`+`handoff`. New
`BoundedOrchestrator.test.ts` + `HookRunner.test.ts`. Build green, 296 core + 88
cli tests pass. SHIPPED on `v2.5.0-alpha.0`.

**v2.6 (Multi-session workspace) FEATURE-COMPLETE locally (not released).** All
three boxes `[x]`. Item 1 named sessions: `WorkspaceManager` owns
`.ai-session/workspace.json` (active + list); named items under
`.ai-session/sessions/<name>/`, legacy flat `.ai-session` = `default` (zero
migration); `SessionFiles` resolves the active item so all commands follow it;
`session new|switch|use|items|assign|remove`. Item 2 per-agent assignment: work
items carry `assignedAgent`; `run` uses it as default primary (beats
project/config, loses to `--primary`/`--chain`). Item 3 git-worktree isolation:
`GitService.addWorktree/listWorktrees/removeWorktree`; `session worktree
add|remove`; `run` executes in the work item's worktree when set (own tree + own
`.ai-session`) for safe parallelism; registry stays in main repo. New
`WorkspaceManager.test.ts` + `GitWorktree.test.ts` + relayChain assignment test.
Build green, 304 core + 89 cli tests pass. **SHIPPED & VERIFIED on
`v2.6.0-alpha.0`** — release run `27669752717` green (first release with the
macOS DMG-retry fix; no flake), provenance verifies (SLSA v1), `sbom-diff.md`
published (no dep changes vs v2.5.0-alpha.0), 9 assets. Next: **v2.7 — GA** (first
public release as v1.0.0: LICENSE, npm publish, GA versioning, code signing,
package managers). Post-GA proposed line **v2.8 — Smarter relay** added to
ROADMAP: deterministic ideas borrowed narrowly from Hermes/OpenCode (broadened
fallback triggers + advisory routing hints) — explicitly NOT their resident
orchestrator-AI architecture (decision: relay-baton stays a baton-touch harness,
not a judge-AI control loop).

**v2.7 GA — Phase 0 IN PROGRESS (local, not released).** Decisions: **MIT**
license + GA cut as **1.0.0** (off the alpha line). Done: top-level `LICENSE`
(MIT, © 2026 DongGeon Lee) + per-package copies + `license` fields; all four
packages versioned 1.0.0 (+ CLI `--version`); all four publish under the
**`@relay-baton` scope** (npm org `relay-baton`, free): **`@relay-baton/cli`** +
core/shared/tui. (Naming history: unscoped `relay-baton` is taken on npm @
v4.0.5, and `relaybaton` was rejected by npm as "too similar" — so the CLI lives
in the scope; bin stays `relay-baton`.) `publishConfig.access:public`/`files`/
`engines`/`repository` on all four; `CHANGELOG.md` + `CONTRIBUTING.md` + issue
templates added; README npm quickstart (`npm i -g @relay-baton/cli`) + badge.
**PUBLISHED to npm @ 1.0.0:** `@relay-baton/shared`, `@relay-baton/core`,
`@relay-baton/tui` are live; `@relay-baton/cli` pending re-run after the rename
(2FA needs an automation token; `git push` + `v1.0.0` tag still pending).
**Remaining in Phase 0:** publish `@relay-baton/cli`, demo GIF (deferred). Then Phase 1 (signing, package managers) + Phase 2 (announce). No
commit/push yet (awaiting user request).

**2026-07-10 — released as v1.3.0** (tag pushed; first release where the npm
publish job runs with the NODE_AUTH_TOKEN fix — verify all four channels).
Multilingual notes (EN+ko+8 locales) + CHANGELOG + README/i18n Latest lines all
updated to v1.3.0. Detail of what shipped: (1) v2.8 features now
documented in `docs/COMMANDS.md` + `COMMANDS.ko.md` + GUIDE EN/KO + README config
section (`--handoff-now`, `handoffTriggers` block, routing hints). (2) Friendly
`ui.ts` output extended beyond `run` to `doctor`/`init`/`status`/`login`/
`handoff` (doctor/login now respect NO_COLOR/non-TTY). (3) New read-only
**`relay-baton route "<task>" [--json]`** command exposing `suggestChain`
(+`route.test.ts`, 3 tests → 92 cli). (4) `doctor` surfaces whether
`handoffTriggers` is configured. (5) Record-ready demo:
`scripts/demo/demo.sh` + `fake-agent.mjs` (deterministic fallback→handoff→resume,
no quota; verified end-to-end on this machine — needs `cygpath -m` on Git Bash,
already handled). Ship these as v1.2.1 or fold into the next minor.

**Decisions (this session):**
- Multi-session/multi-task is now its own **v2.6** line (pulled in before GA):
  unifies per-agent session assignment + multi-tasking as named "work items";
  parallel execution only via per-item git worktrees (no daemon, deterministic).
- GA will be cut as **v1.0.0 at v2.7** (after Phase-0 blockers: LICENSE, npm
  publish, GA versioning). v2.x stays alpha until then._

Prior: **v2.2 SHIPPED & VERIFIED on `v2.2.0-alpha.0`** (run `27597659547` green;
provenance attestation verifies, `sbom-diff.md` published). Roadmap milestone
**v2.6 — Public release & distribution (GA)** captures launch blockers (LICENSE,
npm publish, code signing, package managers, announce)._

**v2.2 detail (all local):**
- **(1) Path-traversal safety** — `inspect` on handoff bundles & session archives
  refuses untrusted manifest `target`s via shared `resolveWithin` (rejects
  absolute / `..` / symlink) + 8 MiB cap; results gain `unsafe[]` + top-level
  `safe` (CLI prints `trust: safe|UNSAFE`). Bundler/archiver now write
  bundle-relative POSIX targets. New `packages/shared/src/safe-path.ts`,
  `pathTraversalSafety.test.ts`. 262 core + 83 cli tests pass.
- **(2) Provenance by default** — `release.yml` `release-finalize` attests the 3
  CLI binaries + `SHA256SUMS` with `actions/attest-build-provenance` (default
  token, no secrets). Added `attestations: write`. Verify:
  `gh attestation verify <file> --repo dgl1231/relay-baton`.
- **(3) Supply-chain hardening** — all Actions pinned by SHA (`ci.yml` +
  `release.yml`); `.github/dependabot.yml` (npm root+desktop, cargo, actions,
  grouped weekly); `.github/scripts/sbom-diff.mjs` diffs SBOM vs previous release
  → `sbom-diff.md`. CI/workflow YAML validated.

## Where we are

- **v1.9 alpha is SHIPPED** on tag **`v1.9.0-alpha.0`** — team handoff package
  (`handoff bundle`/`inspect`, redaction pass, `report`, desktop export).
- **v1.8 alpha is SHIPPED** on tags **`v1.8.0-alpha.0`** / **`v1.8.0-alpha.1`** —
  project intelligence (`workspace`, `profile`, `inventory`, desktop inspector).
- **v1.7 alpha is SHIPPED** on tag **`v1.7.0-alpha.0`** — guarded execution
  (`checkpoint`, `guard`, `risk`, desktop guarded-execution view).
- **v2.1 is COMPLETE** — "Reliability & secret safety": Windows-safe agent spawn
  (`alpha.0`), redact-before-handoff Redaction Gate (`alpha.1`), and secret-leak
  regression scan + `--allow-api-key-env` audit (latest, local). All three v2.1
  roadmap boxes are `[x]`. Next line: v2.2 (Trust & supply chain).
- **v2.2 is FEATURE-COMPLETE locally** — "Trust & supply chain". All three boxes
  `[x]`: path-traversal safety, signed releases + provenance by default, and
  supply-chain hardening (pinned actions + Dependabot + SBOM diff). Not yet
  released.
- **v2.0 is FEATURE-COMPLETE** — alpha.0..alpha.6 shipped (migration checks,
  schema migrator, desktop contract, hard constraints, installer/docs finalize,
  git-baseline schema, prune policy + CI race fix). Latest local (not yet
  released): conversation-event schema versioning + `session export`, closing the
  last v2.0/v1.6 `[~]` items. Every planned v1.x/v2.0 roadmap box is now `[x]`.
  Future direction captured in ROADMAP "Beyond v2.0 — proposed" (additions +
  hardening; nothing committed). Only remaining `[~]`: v1.2 desktop local-build
  note (environment caveat, not code).
- **v1.6 alpha is SHIPPED** on tag **`v1.6.0-alpha.0`** — session archives &
  recovery (read-only `session archive`/`list`/`inspect`/`resume` + desktop
  panel). Release run `27330492827` succeeded with all 8 assets published.
- **v1.5 alpha is SHIPPED** on tags **`v1.5.0-alpha.0`** and
  **`v1.5.0-alpha.1`**. `alpha.0` added read-only git
  tracking, session baselines, desktop Git panel, Agent Room `/git`, and bounded
  git summaries in status/review/handoff surfaces. `alpha.1` closed the v1.4
  deferred desktop updater item with opt-in/manual checks and signed-updater
  artifact support when secrets exist.
- **v1.4 alpha is SHIPPED** on tag **`v1.4.0-alpha.1`**. Its deferred updater
  item is resolved in `v1.5.0-alpha.1`.
- **v1.1 is SHIPPED** on tag **`v1.1.3`**. The GitHub Release carries three
  working standalone binaries:
  - `relay-baton-linux-x64`
  - `relay-baton-macos-arm64`
  - `relay-baton-windows-x64.exe`
- Current release workflow for `v1.5.0-alpha.1` was started after tag push.
  At the time this handoff was written, CLI binary jobs and macOS desktop had
  passed; Linux/Windows desktop were still running. Re-check with:
  `gh run view 27326048647 --repo dgl1231/relay-baton --json status,conclusion,jobs`.
  README "Download" links point at `releases/latest`.

## What v1.1 delivered

- Per-OS single-file executables via **Node SEA** (esbuild bundle → SEA blob →
  inject into a copied `node` with postject → codesign on macOS).
- Automated release pipeline: [`.github/workflows/release.yml`](../.github/workflows/release.yml),
  triggered by `v*` tags, attaches binaries to the Release.
- Tauri desktop **scaffold** in [`desktop/`](../desktop) (sidecar over the CLI,
  outside the pnpm workspace). NOT a full GUI yet — that's v1.2.
- Docs: [`RELEASE.md`](./RELEASE.md) (runbook + gotchas), this file.

## How v1.1 was hard-won (so we don't regress)

The first tag failed; it took v1.1.0 → v1.1.3 to get green. Four distinct
issues, all in `release.yml` — full detail in [`RELEASE.md`](./RELEASE.md):

1. v1.1.0 — leading `&` in a pwsh `run:` scalar = YAML anchor → invalid workflow,
   no job ran.
2. v1.1.1 — `npx --yes esbuild/postject` not on PATH → exit 127.
3. v1.1.2 — `postject@^1` doesn't exist (its "latest" is a prerelease) → ETARGET.
4. v1.1.3 — pinned exact `esbuild@0.28.0` + `postject@1.0.0-alpha.6`. ✅

## Current cleanup: v1.5 closed

v1.5 feature work has shipped and all acceptance criteria in
[`TASK-v1.5-git-tracking.md`](./TASK-v1.5-git-tracking.md) are checked:

- `relay-baton git status` / `relay-baton git status --json`
- non-git fallback with `available:false`
- `.ai-session/git-baseline.json` on `init`
- session baseline comparison in `git status --json`
- bounded git summaries in `status --json`, `review --json`, and generated handoffs
- desktop Git panel and Agent Room `/git`

The v1.4 deferred updater item is being closed with:

- Tauri updater/process plugins wired in the desktop shell.
- Dashboard update card with opt-in/manual check.
- Install still requires explicit confirmation; no silent updates.
- CI enables updater artifacts only when Tauri updater signing secrets exist.
- `latest.json` is generated only when signed updater artifacts are present.

## v1.6 — SHIPPED on `v1.6.0-alpha.0`

Session archives & recovery, all read-only:
`session archive` / `session list` / `session inspect` / `session resume`, plus a
desktop session-archive panel + Agent Room `/sessions`, `/inspect`, `/resume`
(all through the CLI sidecar). Manifest + SHA-256 integrity checks. Every v1.6
acceptance item in [`TASK-v1.6-session-archives.md`](./TASK-v1.6-session-archives.md)
is checked. Deferred (later only): prune (dry-run first), zip/export.

## v1.7 — feature-complete (guarded execution workflow)

Roadmap: [`ROADMAP.md`](./ROADMAP.md) → "v1.7 — Guarded execution workflow".
Implemented locally after `v1.6.0-alpha.0`:

- **Execution checkpoints** — `packages/core/src/plan/ExecutionCheckpoints.ts`;
  append-only JSON in `.ai-session/checkpoints.jsonl` (command, changed files,
  git summary, budget, result, ts). `list()` tolerant of malformed lines;
  `summarize()` builds the compact receipt. New `SESSION_FILES.checkpoints`.
  CLI: `checkpoint add <step>`, `checkpoint list`, `checkpoint summary`.
- **Stop-condition policy** — `packages/core/src/plan/GuardrailPolicy.ts` +
  `relay-baton guard [--json] [--exit-code]`. Caps from optional `guardrails`
  config (defaults: maxSteps 25, maxChangedFiles 40, maxBudgetRatio 0.9,
  requireConfirmation). Advisory; `--exit-code` exits 10 when blocked.
- **Risk classifier** — `packages/core/src/plan/RiskClassifier.ts` +
  `relay-baton risk [--json]`. Flags deps/deletions/release/env-config/binary
  from git status with category + severity.
- **Better receipts** — `checkpoint summary` (see above).
- **Desktop guarded-execution view** — dashboard "guarded execution" card +
  Agent Room `/checkpoints`, `/guard`, `/risk` (`desktop/ui/index.html`), all
  read-only via the CLI sidecar.
- tests: core `ExecutionCheckpoints` (7), `GuardrailPolicy` (4),
  `RiskClassifier` (4); CLI `checkpoint`, `guard`, `risk`. docs EN + KO.

Validation already run:

```bash
corepack pnpm build   # green
corepack pnpm test    # 207 core + 64 cli pass
node packages/cli/dist/index.js checkpoint add 1 --command "pnpm build" --result ok --path .
node packages/cli/dist/index.js checkpoint summary --path .
node packages/cli/dist/index.js guard --path .
node packages/cli/dist/index.js risk --path .
```

Next: cut a `v1.7.0-alpha.0` release per `RELEASE.md` when ready, then start v1.8
(project intelligence & workspace map).

Hard rule remains: GUI calls the CLI sidecar only. **No business logic in the
webview.** Read-only or confirmation-first. No auto commit/push/PR unless the
human explicitly asks for it.

## Environment notes (this dev machine)

- `pnpm` is **not** on PATH directly. Use `corepack enable --install-directory
  /tmp/rbshim pnpm && export PATH=/tmp/rbshim:$PATH`, or just `corepack pnpm`.
- `npx esbuild` fails locally too — install globally
  (`npm i -g esbuild@0.28.0 postject@1.0.0-alpha.6`) and call the bin directly.
- `gh` CLI availability is **machine-specific** — re-check on each machine.
  - On the original Linux dev box it was unusable (config root-owned, 0600), so
    the human checked Actions/Releases in the browser.
  - On the Windows dev box it works fine: `gh 2.91.0`, logged in as `dgl1231`
    (token scopes `repo`, `workflow`, `read:org`, `gist`) — use `gh` directly
    for Actions/Releases/PRs there.
- Repo branch protection prints "Changes must be made through a pull request" on
  push, but the push still lands on `main` (confirm with `git rev-parse
  origin/main`). Tags push cleanly.

## How to cut the next release

See [`RELEASE.md`](./RELEASE.md) → "TL;DR — cut a release". Short version: bump
versions everywhere, add release notes (en+ko) + index, update README badge,
commit, push, then `git tag vX.Y.Z && git push origin vX.Y.Z`.

## Verify everything still works

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm test
```
