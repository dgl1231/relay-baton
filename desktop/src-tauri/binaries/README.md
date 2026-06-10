# Tauri sidecar binaries

This directory holds the `relay-baton` CLI binary that the desktop app bundles
and runs as a Tauri **sidecar** (`externalBin` in `../tauri.conf.json`). The
binaries themselves are **not** committed (see `../../.gitignore`) — only this
README is.

Tauri resolves a sidecar by appending the build host's **target triple** to the
configured name. With `"externalBin": ["binaries/relay-baton"]`, a build looks
for:

| Host         | Expected file                                  |
| ------------ | ---------------------------------------------- |
| linux-x64    | `relay-baton-x86_64-unknown-linux-gnu`         |
| macos-arm64  | `relay-baton-aarch64-apple-darwin`             |
| macos-x64    | `relay-baton-x86_64-apple-darwin`              |
| windows-x64  | `relay-baton-x86_64-pc-windows-msvc.exe`       |

## How to populate it

Use the staging script — it maps a Release artifact (or a locally-built SEA
binary) to the triple name Tauri expects and sets the executable bit on Unix:

```bash
cd desktop

# Auto-detect host; finds ../dist-bin/relay-baton-<os> or ./dist-bin/...
npm run stage-sidecar

# Or point it at a specific binary / triple:
npm run stage-sidecar -- --from /path/to/relay-baton-linux-x64
npm run stage-sidecar -- --from ./relay-baton.exe --target x86_64-pc-windows-msvc
```

The source binary is the same single-file executable produced by
[`.github/workflows/release.yml`](../../../.github/workflows/release.yml)
(esbuild bundle → Node SEA → postject). In CI, the desktop build job stages the
matching artifact here before `tauri build`.
