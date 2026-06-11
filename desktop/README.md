# relay-baton desktop (Tauri)

A thin **desktop shell** over the existing relay-baton CLI. It does **not**
re-implement any business logic: the window is a webview that talks to the
packaged `relay-baton` binary as a **Tauri sidecar** (`externalBin`), reusing
`packages/core` through the CLI exactly like the terminal does.

This keeps every hard constraint intact:

- no direct OpenAI/Anthropic API calls (the CLI still spawns `codex` / `claude`)
- no API-key storage, no auto commit/push/PR
- deterministic compaction only

## Status

**v1.2 (alpha)** — desktop dashboard: project switcher plus add/remove controls
(native folder picker), status + budget panels, diet selector, read-only
handoff preview, and an Agent Room timeline (`replay`) with a
confirmation-first action palette. Quality-of-life: persisted window
size/position (`tauri-plugin-window-state`), a light/dark theme toggle,
dependency-free UI language selector (English default, Korean, Japanese,
Simplified Chinese), and keyboard shortcuts mirroring the Ink TUI
(`r`/`p`/`d`/`b`/`h`/`t`/`q`/`?`). The GUI is sidecar-only /
confirmation-first and never spawns an agent itself (see
[`docs/ROADMAP.md`](../docs/ROADMAP.md) § v1.2).

**v1.3 (alpha)** — in-app Agent Room composer/check surface with visible
project/session context. Plain text messages and command echoes are persisted
through `relay-baton conversation append` into the active project's
`conversation.jsonl`; slash-command checks run through the sidecar; and
agent-launching commands stay preview/confirm-first.

**v1.4/v1.5 (alpha)** — distribution hardening plus session insight: optional
signing/notarization hooks, one-line installers, checksums/SBOM, a Codex/Claude
preview target switcher, read-only git tracking, and an opt-in/manual Tauri
updater surface. Update checks never run until the user enables them and clicks
**Check updates**.

It lives outside the pnpm workspace (`desktop/`, not `packages/`) so the
TypeScript build and test CI are unaffected and you only need the Rust/Tauri
toolchain when you actually build the app.

## Architecture

```
┌────────────────────────┐
│ Tauri window (webview) │   desktop/ui/index.html
│   calls sidecar ──────────────┐
└────────────────────────┘      │
                                 ▼
                    relay-baton (CLI binary)        ← Release artifact
                    relay-baton status --json       ← reused as-is
                                 │
                                 ▼
                         packages/core
```

The sidecar binary is the same single-file executable produced by
`.github/workflows/release.yml`. Drop it into
`desktop/src-tauri/binaries/relay-baton-<target-triple>` before bundling
(Tauri's `externalBin` naming convention).

## Build (requires Rust toolchain)

The Tauri CLI is pinned as a dev dependency in [`package.json`](./package.json),
so you don't need a global `cargo tauri` install — just Node + the Rust
toolchain (`rustc` / `cargo`).

```bash
cd desktop
npm install          # installs the pinned @tauri-apps/cli

# 1. Build + stage the CLI sidecar binary (see workflow for the SEA recipe)
#    -> desktop/src-tauri/binaries/relay-baton-<triple>[.exe]

# 2. Run / build the desktop app
npm run dev          # local dev window  (= tauri dev)
npm run build        # installer / .app / .exe under src-tauri/target (= tauri build)
```

> If you prefer a global install, `cargo install tauri-cli` then `cargo tauri
> dev` / `cargo tauri build` work the same.

Icons under `src-tauri/icons/` are placeholders; run `npm run icon -- <path-to-png>`
(or `cargo tauri icon <path-to-png>`) to generate the real set before a
production build.
