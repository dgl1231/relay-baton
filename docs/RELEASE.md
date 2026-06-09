# Release & Distribution Guide

How relay-baton ships downloadable, per-OS executables. This is the operational
runbook — for the *why* and roadmap, see [`ROADMAP.md`](./ROADMAP.md).

## TL;DR — cut a release

```bash
# 1. bump versions (all packages + CLI --version + desktop)
#    package.json, packages/*/package.json,
#    packages/cli/src/index.ts (.version("x.y.z")),
#    desktop/src-tauri/Cargo.toml, desktop/src-tauri/tauri.conf.json
# 2. add release notes: release-notes/x.y.z.md (+ ko/x.y.z.md), index in release-notes/README.md
# 3. update README latest badge -> x.y.z
git add -A && git commit -m "release: vX.Y.Z — <summary>"
git push
git tag vX.Y.Z && git push origin vX.Y.Z   # ← this triggers the build
```

The `vX.Y.Z` tag push triggers [`.github/workflows/release.yml`](../.github/workflows/release.yml).

## What the pipeline does

On any `v*` tag, a 3-OS matrix (`ubuntu-latest`, `macos-latest`, `windows-latest`)
each:

1. `pnpm install --frozen-lockfile` + `pnpm build`
2. `npm install -g esbuild@0.28.0 postject@1.0.0-alpha.6` (global store only — repo
   lockfile untouched, so the build/test CI stays green)
3. `esbuild` bundles `packages/cli/dist/index.js` → one CJS file
4. `node --experimental-sea-config bin/sea-config.json` → SEA blob
5. copy the host `node` binary, inject the blob with `postject`
   (macOS: `codesign --remove-signature` first, `--macho-segment-name NODE_SEA`,
   then ad-hoc re-sign)
6. smoke test: `<binary> --version`
7. `softprops/action-gh-release@v2` attaches the binary to the GitHub Release

Output assets:
- `relay-baton-linux-x64`
- `relay-baton-macos-arm64`
- `relay-baton-windows-x64.exe`

README "Download" links point at `releases/latest`, so they always resolve to the
newest tag automatically.

## Hard-won gotchas (do not regress)

These each cost a patch release (v1.1.0 → v1.1.3). Keep them in mind:

1. **No bare `&` at the start of a YAML `run:` scalar.** YAML reads a leading `&`
   as an anchor → *"Invalid workflow file"*, the whole workflow fails to parse,
   **no job runs**. Wrap pwsh `& "..."` calls in a `|` block scalar.
2. **`npx --yes <tool>` is unreliable on runners** (exit 127, bin not on PATH).
   Use `npm install -g` then call the bin directly.
3. **`postject`'s published "latest" is a prerelease** (`1.0.0-alpha.6`). A caret
   range (`^1`) excludes prereleases → `ETARGET / No matching version`. Pin the
   **exact** version.
4. **Runner queue delays are normal**, not failures. A job stuck on *"Waiting for
   a hosted runner to come online"* with `Evaluating: success() → true` is queued,
   not broken. Do not cancel.

## Requirements / settings

- Repo: **Settings → Actions → General → Workflow permissions → "Read and write"**
  (needed for the release upload; the workflow also declares `permissions: contents: write`).
- No secrets beyond the default `GITHUB_TOKEN`. No npm publish, no API calls.

## Local verification (optional, before tagging)

The full SEA recipe can be reproduced on macOS:

```bash
pnpm build
npm install -g esbuild@0.28.0 postject@1.0.0-alpha.6
esbuild packages/cli/dist/index.js --bundle --platform=node --target=node20 \
  --format=cjs --outfile=build/relay-baton.cjs
node --experimental-sea-config bin/sea-config.json
cp "$(command -v node)" build/rb-bin
codesign --remove-signature build/rb-bin
postject build/rb-bin NODE_SEA_BLOB build/sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
  --macho-segment-name NODE_SEA
codesign --sign - build/rb-bin
chmod +x build/rb-bin && ./build/rb-bin --version   # -> x.y.z
```

(Note: `npx esbuild` fails locally too — install globally and call directly.)

## Desktop app (v1.2, in progress)

The Tauri desktop app is **not yet** in the release pipeline. When wired up
(v1.2), a Tauri build job will consume the same SEA binary as a sidecar and emit
`.dmg` / `.msi` / `.AppImage`. See [`../desktop/README.md`](../desktop/README.md).
