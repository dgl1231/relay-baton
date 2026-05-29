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

- [v0.6.0](./v0.6.0.md) / [한국어](./ko/v0.6.0.md) - Trust & Verify: `relay-baton verify` (simulated end-to-end check, no real model calls), `doctor --deep` extended diagnostics, TUI mode panel, and `docs/ROADMAP.md`.
- [v0.5.0](./v0.5.0.md) / [한국어](./ko/v0.5.0.md) - Plan-execute mode (`plan` / `execute`, planner→executor, PlanQualityGate) + context compression mode (`compress-context`, deterministic mid-session compaction with a rollback gate). 124 tests.
- [v0.4.0](./v0.4.0.md) / [한국어](./ko/v0.4.0.md) - GitHub Actions CI, critical-path test coverage (99 tests), CLI smoke test, session observability (`startedAt`/`endedAt`/`durationMs`/`handoffCount`), and `relay-baton handoff history`.
- [v0.3.0](./v0.3.0.md) / [한국어](./ko/v0.3.0.md) - Side-effect-free resolver, registry recovery, `RELAY_BATON_PROJECTS_FILE` override, fallback `lastError` cleanup.
- [v0.2.0](./v0.2.0.md) / [한국어](./ko/v0.2.0.md) - Project registry, project-aware commands, improved TUI dashboard, and release documentation.
- [v0.1.0](./v0.1.0.md) / [한국어](./ko/v0.1.0.md) - Initial MVP with Codex/Claude handoff, token diet, fallback detection, session files, quality gates, and auth-safe subprocess execution.
