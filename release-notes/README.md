# Release Notes

This directory records versioned release notes for relay-baton.

Each note should explain:

- What changed
- Why it changed
- User-facing commands or behavior
- Compatibility notes
- Recommended next work

Release notes are user-facing changelogs, not agent handoff material — that role belongs to `.ai-session/handoff.md`. Keep release notes free of one-shot validation logs or test inventories; those go stale and duplicate CI / git history.

## Versions

- [v1.2.0-alpha.2](./v1.2.0-alpha.2.md) / [한국어](./ko/v1.2.0-alpha.2.md) - Desktop sidecar fix: webview now loads Tauri APIs via `withGlobalTauri`/`window.__TAURI__` (bare ES imports don't resolve in the no-bundler frontend), so the GUI panels actually talk to the bundled CLI.
- [v1.2.0-alpha.1](./v1.2.0-alpha.1.md) / [한국어](./ko/v1.2.0-alpha.1.md) - Desktop prerelease completed: Windows `.msi` build fix (plain semver app version) so all 6 assets ship, plus Phase D (signing docs, window-state persistence, light/dark theme, TUI-mirrored keyboard shortcuts).
- [v1.2.0-alpha.0](./v1.2.0-alpha.0.md) / [한국어](./ko/v1.2.0-alpha.0.md) - Desktop GUI prerelease (Phase A+B): `build-desktop` release job attaching `.dmg`/`.msi`/`.AppImage`, deterministic icon generation, sidecar staging script, read-only desktop dashboard, and CLI JSON surface (`project list/current --json`, `handoff show`). Unsigned/ad-hoc installers; GUI is read-only.
- [v1.1.3](./v1.1.3.md) / [한국어](./ko/v1.1.3.md) - Release pipeline hotfix #3: pinned exact bundler versions (`esbuild@0.28.0`, `postject@1.0.0-alpha.6`) — `postject@^1` resolved to nothing because its "latest" is a prerelease. No behavior changes.
- [v1.1.2](./v1.1.2.md) / [한국어](./ko/v1.1.2.md) - Release pipeline hotfix #2: `npx --yes esbuild/postject` failed with exit 127 on CI runners, so the workflow now installs them with `npm install -g` and calls them directly (recipe verified locally end-to-end). No behavior changes.
- [v1.1.1](./v1.1.1.md) / [한국어](./ko/v1.1.1.md) - Release pipeline hotfix: fixed `release.yml` line 115 (a leading `&` in the Windows smoke-test step made the workflow invalid YAML, so no job ran for v1.1.0 and no binaries were attached). New tag re-runs the corrected pipeline. No behavior changes.
- [v1.1.0](./v1.1.0.md) / [한국어](./ko/v1.1.0.md) - Distributable: standalone single-file executables per OS (Node SEA), automated GitHub Release pipeline (`.github/workflows/release.yml`), README download links, and a Tauri desktop shell scaffold (`desktop/`, CLI sidecar). No new model behavior; all hard constraints intact.
- [v1.0.0](./v1.0.0.md) / [한국어](./ko/v1.0.0.md) - Stable Local Release: frozen config/session contracts (`CONFIG_VERSION`/`SESSION_SCHEMA_VERSION`, `validateConfig`/`validateSessionMeta`), `.ai-session/` artifact validation (`validateArtifacts` + `doctor --deep`), full command reference (`docs/COMMANDS.md` EN+KO), finalized Agent Room set with read-only `/diagnose`.
- [v0.9.0](./v0.9.0.md) / [한국어](./ko/v0.9.0.md) - Automation & Runtime (bounded): `LoopController`, room `/continue --max-steps N` / `/replan` / `/replay`, `relay-baton replay`, adaptive per-agent compression thresholds.
- [v0.8.0](./v0.8.0.md) / [한국어](./ko/v0.8.0.md) - Adapter Expansion + Agent Room (first cut): OpenCode/Gemini/Aider adapter scaffolds, project-level fallback overrides, OS CI matrix, `relay-baton chat`/`room` (turn-based, confirmation-first REPL).
- [v0.7.0](./v0.7.0.md) / [한국어](./ko/v0.7.0.md) - Review & Diagnose: `relay-baton review` (deterministic diff-vs-plan), execution receipts, plan diffing, `--json` for status/budget/review, conversation event schema (draft).
- [v0.6.0](./v0.6.0.md) / [한국어](./ko/v0.6.0.md) - Trust & Verify: `relay-baton verify` (simulated end-to-end check, no real model calls), `doctor --deep` extended diagnostics, TUI mode panel, and `docs/ROADMAP.md`.
- [v0.5.0](./v0.5.0.md) / [한국어](./ko/v0.5.0.md) - Plan-execute mode (`plan` / `execute`, planner→executor, PlanQualityGate) + context compression mode (`compress-context`, deterministic mid-session compaction with a rollback gate). 124 tests.
- [v0.4.0](./v0.4.0.md) / [한국어](./ko/v0.4.0.md) - GitHub Actions CI, critical-path test coverage (99 tests), CLI smoke test, session observability (`startedAt`/`endedAt`/`durationMs`/`handoffCount`), and `relay-baton handoff history`.
- [v0.3.0](./v0.3.0.md) / [한국어](./ko/v0.3.0.md) - Side-effect-free resolver, registry recovery, `RELAY_BATON_PROJECTS_FILE` override, fallback `lastError` cleanup.
- [v0.2.0](./v0.2.0.md) / [한국어](./ko/v0.2.0.md) - Project registry, project-aware commands, improved TUI dashboard, and release documentation.
- [v0.1.0](./v0.1.0.md) / [한국어](./ko/v0.1.0.md) - Initial MVP with Codex/Claude handoff, token diet, fallback detection, session files, quality gates, and auth-safe subprocess execution.
