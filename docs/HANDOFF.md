# Session Handoff — relay-baton

> Compact, deterministic handoff for the next session (possibly a fresh/cold
> agent on a different machine). This is the relay-baton concept applied to the
> project itself. Read this first, then `git pull`.
>
> **Keep this file alive:** update it after every meaningful chunk of work (and
> before ending a session) — bump `_Last updated:_`, refresh "Where we are" /
> "Next up", and record any new machine-specific gotchas. See `CLAUDE.md` →
> "세션 핸드오프 규칙".

_Last updated: 2026-06-11 — `v1.6.0-alpha.0` committed to `main`
(`e3b5d54`), tagged, and pushed. v1.6 session archives feature-complete:
`session list` + `session inspect` + `session resume` + desktop read-only
archive panel. All v1.6 acceptance items checked. Release workflow run
`27330492827` in progress — re-check with:
`gh run view 27330492827 --repo dgl1231/relay-baton --json status,conclusion,jobs`._

## Where we are

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

## v1.6 first cut now in progress

Work order: [`TASK-v1.6-session-archives.md`](./TASK-v1.6-session-archives.md).

Implemented locally after `v1.5.0-alpha.1`:

- `packages/core/src/session/SessionArchiver.ts` (`session archive`)
- `packages/core/src/session/SessionArchiveStore.ts` (`list` + `inspect`)
- `packages/core/src/session/ResumeDiagnostics.ts` (`resume`)
- `relay-baton session archive` (`--json`, `--dry-run`, `--out <dir>`)
- `relay-baton session list [--json] [--out <dir>]` — newest-first, graceful
  when archive root missing, flags invalid manifests
- `relay-baton session inspect <archive> [--json] [--out <dir>]` — per-file
  presence/size/SHA-256 verification, `missing`/`corrupt`/`intact` summary
- `relay-baton session resume [--json] [--stale-hours <n>]` — classifies
  missing/incomplete/stale/ok, suggests safe next command, read-only
- desktop dashboard "session archives" card + Agent Room `/sessions`,
  `/inspect <id>`, `/resume` — all through the CLI sidecar, no direct
  archive/`.ai-session` reads from the webview (`desktop/ui/index.html`)
- `manifest.json` with file size and SHA-256 per archived file
- tests: core `SessionArchiveStore.test.ts` (5), `ResumeDiagnostics.test.ts` (4),
  CLI `sessionArchive.test.ts`
- command docs in EN + KO

Validation already run:

```bash
corepack pnpm build   # green
corepack pnpm test    # 188 core + 60 cli pass
node packages/cli/dist/index.js session archive --path .
node packages/cli/dist/index.js session list
node packages/cli/dist/index.js session inspect <id>
```

v1.6 is feature-complete. Next recommended work:

1. Cut a `v1.6` (alpha) release per `RELEASE.md` when ready — bump versions,
   add release notes (en+ko) + index, README badge, commit, tag, push.
2. later only: prune (dry-run first, disabled by default), zip/export.

## Next after v1.6 first cut

Do not start broader v1.7 work until v1.6 list/inspect/resume diagnostics are
done or intentionally deferred. Likely follow-ups:

- Real-window QA / stable promotion cleanup for desktop releases.
- A deeper Git tracking follow-up only if the user wants it, still read-only.
- Session archive/recovery continuation from `docs/ROADMAP.md`.

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
