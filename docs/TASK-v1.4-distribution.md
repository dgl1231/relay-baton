# TASK (for Codex / next agent) — v1.4 distribution polish & hardening

> Self-contained work order. Read this, then `git pull`. Read `CLAUDE.md` and
> `docs/HANDOFF.md` first. Do not start from scratch — the desktop app and the
> release pipeline already exist and work.

_Authored: 2026-06-10. Target: cut `feat/v1.4-*` branches from `main`._

## Context (where things are)

- Shipped through **`v1.3.0-alpha.1`** (tag on `main`). Each `v*` tag runs
  `.github/workflows/release.yml`: a 3-OS `build-binaries` matrix (Node SEA CLI
  binaries) + a 3-OS `build-desktop` matrix (Tauri `.dmg`/`.msi`/`.AppImage`),
  all attached to the GitHub Release. Last run was 6/6 green.
- Installers are **unsigned (Windows) / ad-hoc-signed (macOS)** — users hit
  SmartScreen / Gatekeeper. Documented in `docs/RELEASE.md`.
- Hard constraints (CLAUDE.md) unchanged: sidecar-only GUI, no business logic
  in the webview, no direct LLM API calls, no API-key storage, no auto
  commit/push/PR, deterministic compaction only.

## Goal

Make the builds **trustworthy** (signed) and **effortless to install**
(one-liners, package managers, auto-update), and promote v1.3 to a stable tag.
Each item below is independently shippable — do them in roughly this order.

## 1. Promote v1.3.0 stable

The v1.3 desktop work has only been verified in CI builds + one human install.
Before dropping the alpha:

- On a machine **with a Rust toolchain**, run the real-window QA checklist:
  open the app, switch the Dashboard/Agent Room tabs, add a project via the
  folder picker, switch language (en/ko/ja/zh), type `/` to confirm the command
  palette pops with descriptions, run a read-only command (`/status`), and
  confirm `/plan` `/execute` `/handoff` only **preview** (never launch an agent).
- If clean: bump versions to `1.3.0` (drop `-alpha.N`), add release notes, tag
  `v1.3.0`. Keep `tauri.conf.json` version a plain `1.3.0` (already is).
- If bugs: fix on a branch, re-cut an alpha, re-verify.

## 2. Code signing & notarization

**No free path — needs paid certs.** Wire signing as **optional** CI steps that
no-op when the secrets are absent, so unsigned builds keep working.

- **Windows `.msi`** — preferred: **Azure Trusted Signing** (~$10/mo;
  `azure/trusted-signing-action`), or an EV/OV cert via a cloud signer
  (DigiCert KeyLocker, SSL.com eSigner). Add a post-`tauri build` step in
  `build-desktop` (Windows) that signs the `.msi` only if
  `secrets.AZURE_*` / cert secrets exist (`if:` guard). Self-signed does NOT
  clear SmartScreen — do not bother.
- **macOS `.dmg`** — Apple Developer ID Application cert + `notarytool`
  submission. Tauri supports `bundle.macOS.signingIdentity` + notarize env
  (`APPLE_*` secrets); guard on secret presence.
- Update `RELEASE.md` "Code signing & notarization" from "future work" to the
  actual wired steps once done; update the README download note.

## 2b. Desktop agent switcher (Codex ↔ Claude)

A header toggle/button in the desktop app to pick which agent the Agent Room is
addressing — mirrors the CLI room's `/agent <claude|codex>`
(`packages/core/src/room/RoomCommands.ts`). **Display + pass-through only:**

- Two-state control (e.g. a segmented `Codex | Claude` button) next to the diet
  selector; persist in `localStorage` (`rb-agent`), default the project's
  primary agent if known, else `claude`.
- The chosen agent feeds the **previewed** commands only:
  `/handoff --to <agent>`, and the planner/executor hints for `/plan` /
  `/execute`. It must NOT launch an agent from the GUI — the existing
  preview/confirm model stays (read-only commands run; agent commands preview).
- Optionally append a `conversation append --role <agent>`-style marker so the
  timeline shows which agent is addressed (reuse the existing conversation
  command; do not invent new write paths).
- i18n: the label + tooltip in en/ko/ja/zh. Keep it sidecar-only; no business
  logic in the webview.

## 3. One-line installers

- `install/install.ps1` (Windows) and `install/install.sh` (macOS/Linux): fetch
  the latest release CLI binary for the host OS/arch from
  `releases/latest`, verify its SHA-256 (see item 6), place it on PATH
  (`%LOCALAPPDATA%\Programs` / `~/.local/bin`), and print next steps. No admin
  required. Keep them dependency-light (PowerShell / POSIX sh + curl).
- README: a copy-paste one-liner per OS.

## 4. Homebrew tap / Scoop manifest

- **Scoop** (Windows): a manifest JSON pointing at the release `.exe` + hash;
  can live in this repo (`scoop/relay-baton.json`) or a `scoop-bucket` repo.
- **Homebrew** (macOS/Linux): a tap formula (`homebrew-relay-baton`) installing
  the CLI binary. Community-maintainable; keep it a thin wrapper over the
  release asset. Auto-bump the hash/version on release (a small workflow step).

## 5. Desktop auto-update (opt-in)

_Status: implemented after `v1.5.0-alpha.0` as the final v1.4 deferred item._

- Tauri **updater** plugin: the app checks a release feed and offers an update.
  Requires signing the update artifacts (Tauri updater keypair — separate from
  code-signing) and publishing `latest.json`. Make it **opt-in** (a setting),
  never silent/forced. Respect the no-auto-anything spirit: prompt + confirm.
- Add the updater pubkey to `tauri.conf.json`; the privkey is a CI secret.

Implementation note: CI injects the updater pubkey into `tauri.conf.json` only
when `TAURI_UPDATER_PUBKEY` and `TAURI_SIGNING_PRIVATE_KEY` secrets are present.
Unsigned builds keep shipping without updater artifacts. The desktop dashboard
exposes opt-in/manual checks only; installation asks for confirmation.

## 6. SBOM + checksums

- Generate a `SHA256SUMS` file over all release assets and attach it (a CI step
  after both matrices, e.g. a small `release-finalize` job that downloads the
  artifacts, hashes them, and uploads the sums). Installers (item 3) verify it.
- SBOM: generate CycloneDX/SPDX for the CLI bundle (e.g. `cyclonedx-npm` for the
  workspace) and attach. Keep it best-effort; do not block the release on it.

## Acceptance criteria

- [x] v1.3 stable-promotion cleanup is resolved. It was superseded by later
      v1.4/v1.5 release trains; do not backfill a stale `v1.3.0` tag. Keep
      real-window QA before a future non-alpha desktop tag.
- [x] Windows `.msi` and macOS `.dmg` are signed/notarized when secrets are
      present; the release still succeeds (unsigned) when they are absent.
- [x] `install.ps1` / `install.sh` install the CLI on a clean machine and it
      runs (`relay-baton --version`).
- [x] Scoop manifest + Homebrew formula install the CLI; hashes auto-track.
- [x] Desktop has a Codex/Claude agent switcher that only affects previewed
      commands (never launches an agent); persisted + localized.
- [x] Desktop updater is opt-in and confirmation-first; no silent updates.
- [x] `SHA256SUMS` attached to each release; installers verify it.
- [x] `corepack pnpm build` + `corepack pnpm test` stay green; docs (ROADMAP,
      RELEASE, HANDOFF, README) updated; hard constraints intact.

## Environment notes (carry-over)

- Use `corepack pnpm …` (pnpm not on PATH on the Windows dev box).
- `gh` works on the Windows box (logged in as dgl1231); re-check per machine.
- Rust toolchain is **not** on the Windows dev box used so far — the desktop /
  Tauri-side verification needs a Rust machine.
- Release CI gotchas (incl. **MSI rejects non-numeric prerelease → keep
  `tauri.conf.json` version plain `x.y.z`**) live in `docs/RELEASE.md`.

## Out of scope

- Direct LLM API client, auto commit/push/PR, daemons, real-time chat platform,
  IDE extensions (permanently out of scope — see ROADMAP).
