# Changelog

All notable changes to relay-baton are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Per-release detail (EN + KO) lives in [`release-notes/`](./release-notes/). This
file is the condensed, user-facing history.

## [1.0.0] — 2026-06-22

First public, generally-available release. relay-baton graduates off the
perpetual `-alpha.N` line. No feature changes versus `2.6.0-alpha.0`; this
release makes the project legally usable and installable.

### Added
- **MIT `LICENSE`** at the repository root (previously unlicensed / "all rights
  reserved"). `license: "MIT"` declared in every package manifest.
- **npm distribution** — the CLI publishes as the unscoped package
  **`relaybaton`** (the unhyphenated name; `relay-baton` was already taken on
  npm). It installs the familiar `relay-baton` command, so `npm i -g relaybaton`
  / `npx relaybaton` work without a clone or build. The `@relay-baton/core`,
  `@relay-baton/shared`, and `@relay-baton/tui` libraries publish as public
  scoped packages.
- **`CHANGELOG.md`** (this file), derived from `release-notes/`.
- README: npm-based quickstart path alongside the from-source flow.

### Changed
- All packages versioned to **1.0.0**; CLI `--version` reports `1.0.0`.

### Hard constraints (unchanged, locked by tests)
- No direct OpenAI/Anthropic API calls; subprocess-only via the local
  `codex` / `claude` CLIs.
- No storing/printing API keys; provider key env vars blocked by default.
- No auto commit/push/PR; no daemon; deterministic compaction only.

## Pre-1.0 history (alpha line)

Condensed; see `release-notes/` for the full notes of each tag.

- **2.6** — Multi-session workspace: named work items, per-agent assignment,
  safe parallelism via git worktrees.
- **2.5** — Guarded automation & extensibility: bounded `run --until <n>`,
  project recipes/hooks. Never an unattended daemon.
- **2.4** — Smarter handoff: deterministic compaction v2 (symbol-aware repo map,
  relevance-ranked diff) + local usage ledger (`relay-baton usage`).
- **2.3** — Multi-agent breadth: central agent registry, OpenCode/Gemini/Aider
  supported + Cursor CLI, N-way & reverse relay (`run --chain`).
- **2.2** — Trust & supply chain: path-traversal-safe `inspect`, signed releases
  + SLSA provenance, pinned actions + Dependabot + SBOM diff.
- **2.1** — Reliability & secret safety: Windows-safe agent spawn, redact-before-
  handoff gate, secret-leak regression scan.
- **2.0** — Stable desktop + local handoff platform: stable artifact schema v2 +
  `migrate`, public docs pass, hard constraints reaffirmed by tests.
- **1.9** — Team handoff package: portable `handoff bundle`/`inspect`, redaction
  pass, markdown `report`, desktop export.
- **1.8** — Project intelligence: `workspace`, `profile`, `inventory`, desktop
  project inspector.
- **1.7** — Guarded execution workflow: `checkpoint`, `guard`, `risk`, receipts.
- **1.6** — Session archives & recovery: `session archive|list|inspect|resume|
  prune`, integrity checks.
- **1.5** — Git tracking & session insight: read-only git snapshots, session
  baselines, review/handoff git context.
- **1.4** — Distribution polish: signing/notarization hooks, installers, package
  manifests, checksums, SBOM, desktop updater.
- **1.3** — Desktop conversation + project-scoped sessions.
- **1.2** — Desktop GUI (Tauri sidecar over the CLI).
- **1.1** — Distributable: standalone single-file executables per OS, automated
  GitHub Release pipeline.
- **1.0** — Stable Local Release: frozen config/session contracts, full command
  reference + i18n parity.
- **0.1 – 0.9** — MVP through bounded automation: Codex→Claude handoff, token
  diet, fallback detection, project registry, TUI, plan/execute, trust/verify,
  review/diagnose, adapter expansion + Agent Room.

[1.0.0]: https://github.com/dgl1231/relay-baton/releases/tag/v1.0.0
