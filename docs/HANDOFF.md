# Session Handoff — relay-baton

> Compact, deterministic handoff for the next session (possibly a fresh/cold
> agent on a different machine). This is the relay-baton concept applied to the
> project itself. Read this first, then `git pull`.
>
> **Keep this file alive:** update it after every meaningful chunk of work (and
> before ending a session) — bump `_Last updated:_`, refresh "Where we are" /
> "Next up", and record any new machine-specific gotchas. See `CLAUDE.md` →
> "세션 핸드오프 규칙".

_Last updated: 2026-06-10 — v1.2 Phase A — sidecar staging script done._

## Where we are

- **v1.1 is SHIPPED** on tag **`v1.1.3`**. The GitHub Release carries three
  working standalone binaries:
  - `relay-baton-linux-x64`
  - `relay-baton-macos-arm64`
  - `relay-baton-windows-x64.exe`
- All three matrix jobs are green. README "Download" links point at
  `releases/latest`, so they resolve to v1.1.3 automatically.
- `main` HEAD = the `v1.1.3` commit. Working tree should be clean.

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

## Next up: v1.2 — Desktop GUI

Full phased plan in [`ROADMAP.md`](./ROADMAP.md) (§ v1.2). **Phase A in progress:**

1. Make `desktop/` build locally — **partly done**: `desktop/package.json` now
   pins `@tauri-apps/cli` (dev dep) with `dev`/`build`/`icon` scripts, README
   updated. **Remaining (needs a Rust toolchain machine):** generate real icons
   (`npm run icon -- <png>`) and confirm `npm run dev` opens the window + sidecar
   calls succeed. (This dev box has Node but no `cargo`/`rustc`.)
2. Sidecar-staging step — **done**: `desktop/scripts/stage-sidecar.mjs`
   (`npm run stage-sidecar`) copies `relay-baton-<triple>` into
   `desktop/src-tauri/binaries/`. Tested for all three triples on Windows.
3. **Next:** add a desktop build job to `release.yml` that, after the SEA
   binaries exist, runs `tauri build` per OS and attaches `.dmg`/`.msi`/
   `.AppImage` to the Release. Then (item 4) add desktop downloads to the README.

Hard rule for v1.2: the GUI calls the CLI sidecar only. **No business logic in
the webview.** Read-only or confirmation-first. (Matches `CLAUDE.md`: TUI/GUI
holds no business logic; no auto commit/push/PR; subprocess-only.)

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
corepack pnpm test      # expect 7 files / 39 tests passing
```
