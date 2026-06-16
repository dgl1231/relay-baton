# Release & Distribution Guide

How relay-baton ships downloadable, per-OS executables. This is the operational
runbook — for the *why* and roadmap, see [`ROADMAP.md`](./ROADMAP.md).

## Finalized distribution & update policy (v2.0)

The distribution story is considered **finalized** for the v2.0 line. What every
`v*` release produces:

- **Always**, with no secrets required:
  - 3 CLI single-file binaries (`relay-baton-linux-x64`,
    `relay-baton-macos-arm64`, `relay-baton-windows-x64.exe`); macOS is ad-hoc
    codesigned in CI.
  - 3 desktop installers (`.dmg`, `.AppImage`, `.msi`) — unsigned fallback when
    signing secrets are absent.
  - `SHA256SUMS` and a CycloneDX SBOM (`relay-baton.cdx.json`).
  - One-line installers (`install/install.sh`, `install/install.ps1`) download
    from `releases/latest` and **verify against `SHA256SUMS`** before installing
    to a user-area PATH (no admin required).
- **Conditional**, only when the matching repo secrets exist:
  - macOS signing/notarization (Apple secrets) and Windows MSI signing (Azure
    secrets) — see "Code signing & notarization".
  - Signed Tauri updater artifacts + `latest.json` for the **opt-in, manual**
    desktop update channel — see "Desktop updater".

User-facing trust model: unsigned builds still ship, so Gatekeeper/SmartScreen
prompts are expected on unsigned releases; the documented workaround and the
`SHA256SUMS` verification path cover that. The desktop updater never runs
silently. Package-manager starter files (`scoop/`, `homebrew/`) are thin and
hash-bumped after assets exist. This policy is locked; future changes are
additive (e.g. enabling a secret) rather than structural.

## TL;DR — cut a release

```bash
# 1. bump versions (all packages + CLI --version + desktop)
#    package.json, packages/*/package.json,
#    packages/cli/src/index.ts (.version("x.y.z")),
#    desktop/src-tauri/Cargo.toml, desktop/src-tauri/tauri.conf.json
# 2. add release notes: release-notes/x.y.z.md (+ ko/x.y.z.md), index in release-notes/README.md
# 3. update README latest badge -> x.y.z
# 4. for Scoop/Homebrew starter files, bump version/URLs/hashes after the release assets exist
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

After the binary + desktop matrices complete, `release-finalize` downloads the
release assets, writes `SHA256SUMS`, generates a best-effort CycloneDX SBOM
(`relay-baton.cdx.json`), and uploads both back to the same Release. The
one-line installers verify downloaded CLI binaries against `SHA256SUMS`.

When Tauri updater signing secrets are configured, the desktop matrix also
creates signed updater artifacts and `release-finalize` publishes `latest.json`
for the desktop app's manual update check. Without those secrets, updater
artifacts are skipped and the normal unsigned desktop installers still ship.

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
5. **MSI rejects non-numeric prerelease versions.** `tauri build` on Windows
   (WiX/MSI) fails with *"optional pre-release identifier in app version must be
   numeric-only…"* if `tauri.conf.json` `version` is e.g. `1.2.0-alpha.0`. The
   `.dmg`/`.AppImage` targets accept it; only MSI is strict. Keep
   **`desktop/src-tauri/tauri.conf.json` `version` a plain `x.y.z`** (the
   installer's ProductVersion); the prerelease lives in the git tag / release
   name, not the MSI. First hit on `v1.2.0-alpha.0` (desktop windows-x64 only).
6. **Parallel matrix jobs must not each create the Release.** When all three
   `build-binaries` jobs called `softprops/action-gh-release` to create the
   release at once, the losers failed with *"Validation Failed: tag_name
   already_exists"* and skipped `build-desktop` + `release-finalize` (hit on
   `v2.0.0-alpha.4`). Fix: a dedicated `create-release` job runs first
   (idempotent `gh release create`), and the matrix only uploads assets to the
   existing release. Recover a half-failed release with
   `gh run rerun <id> --failed`.

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

The Tauri desktop app ships from the same `v*` tag. After `build-binaries`,
the `build-desktop` matrix job (in [`release.yml`](../.github/workflows/release.yml))
downloads the SEA binary, stages it as a Tauri **sidecar**
(`npm run stage-sidecar`), generates icons (`npm run icon`), runs `tauri build`,
and attaches the per-OS installer to the same Release:

- macOS → `.dmg`
- Windows → `.msi`
- Linux → `.AppImage`

See [`../desktop/README.md`](../desktop/README.md) for the local build path.

## Code signing & notarization

Signing is wired as optional CI. Unsigned builds still ship when secrets are
absent; trusted signing requires paid provider accounts/certificates.

- **macOS** — `build-desktop` passes Apple/Tauri signing environment variables
  through to `npm run build` when these repo secrets are configured:
  `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`,
  `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`. Tauri handles signing and
  notarization when the required values are present.
- **Windows** — after `tauri build`, the Windows desktop job signs `.msi` files
  with `azure/artifact-signing-action@v2` when Azure signing secrets are present:
  `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`,
  `AZURE_SIGNING_ENDPOINT`, `AZURE_SIGNING_ACCOUNT`,
  `AZURE_SIGNING_CERTIFICATE_PROFILE`.
- **Linux** — `.AppImage` remains unsigned, which is normal for AppImage.

## Desktop updater

The desktop updater is opt-in and confirmation-first:

- The app never checks for updates until the user enables update checks in the
  desktop dashboard.
- The user must click **Check updates** manually.
- If an update exists, the app asks for confirmation before download/install.
- No silent or forced update path is wired.

Updater release assets are generated only when both of these repo secrets are
present:

- `TAURI_UPDATER_PUBKEY` — public key copied into the CI-generated
  `tauri.conf.json` updater config for that build.
- `TAURI_SIGNING_PRIVATE_KEY` — private key content or path used by Tauri to
  sign updater artifacts. Optional password: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

The workflow then uploads platform updater signatures/artifacts and generates a
static `latest.json` at:

```text
https://github.com/dgl1231/relay-baton/releases/latest/download/latest.json
```

If these secrets are absent, the dashboard shows updater checks as unavailable
for that build. This keeps the regular release path green while leaving the
trusted update channel ready for signed builds.

### What users see, and the workaround

- **macOS Gatekeeper** — first launch is blocked ("can't be opened because Apple
  cannot check it for malicious software"). Workaround: **right-click → Open**,
  then confirm; or `xattr -dr com.apple.quarantine /Applications/relay-baton.app`.
- **Windows SmartScreen** — "Windows protected your PC". Workaround: **More info
  → Run anyway**.

Document this in the release notes for every desktop release (the v1.2 notes
already do).

### Installer scripts

- `install/install.sh` supports Linux x64 and macOS Apple Silicon.
- `install/install.ps1` supports Windows x64.
- Both download from `releases/latest`, verify `SHA256SUMS`, install without
  admin rights, and print a `relay-baton --version` next step.

### Package manager starter files

- `scoop/relay-baton.json` installs the Windows CLI binary.
- `homebrew/relay-baton.rb` installs the macOS arm64 or Linux x64 CLI binary.
- Hashes must be bumped after each release asset is uploaded. They are kept in
  this repo as thin starter files; a separate tap/bucket can mirror them later.
