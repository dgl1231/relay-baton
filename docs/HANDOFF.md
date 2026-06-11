# Session Handoff — relay-baton

> Compact, deterministic handoff for the next session (possibly a fresh/cold
> agent on a different machine). This is the relay-baton concept applied to the
> project itself. Read this first, then `git pull`.
>
> **Keep this file alive:** update it after every meaningful chunk of work (and
> before ending a session) — bump `_Last updated:_`, refresh "Where we are" /
> "Next up", and record any new machine-specific gotchas. See `CLAUDE.md` →
> "세션 핸드오프 규칙".

_Last updated: 2026-06-11 — v1.4/v1.5 cleanup in progress after
`v1.5.0-alpha.0`: desktop updater hooks/UI are being wired as the final v1.4
deferred item; v1.5 git tracking has already shipped._

## Where we are

- **v1.5 alpha is SHIPPED** on tag **`v1.5.0-alpha.0`**. It added read-only git
  tracking, session baselines, desktop Git panel, Agent Room `/git`, and bounded
  git summaries in status/review/handoff surfaces.
- **v1.4 alpha is SHIPPED** on tag **`v1.4.0-alpha.1`**. Its remaining deferred
  item was the desktop auto-update channel; that is now being finished as an
  opt-in/manual Tauri updater path.
- **v1.1 is SHIPPED** on tag **`v1.1.3`**. The GitHub Release carries three
  working standalone binaries:
  - `relay-baton-linux-x64`
  - `relay-baton-macos-arm64`
  - `relay-baton-windows-x64.exe`
- Current release workflow for `v1.5.0-alpha.0` was green across CLI, desktop,
  checksums, and SBOM. README "Download" links point at `releases/latest`.

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

## Current cleanup: finish v1.4, then re-close v1.5

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

## Next after v1.5

Do not start v1.6 until the v1.4/v1.5 cleanup commit is pushed/tagged or the
user explicitly asks to keep it local. Likely v1.6 candidates:

- Real-window QA / stable promotion cleanup for desktop releases.
- A deeper Git tracking follow-up only if the user wants it, still read-only.
- Session archive/recovery work from `docs/ROADMAP.md`.

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
