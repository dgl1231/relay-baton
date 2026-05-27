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

- [v0.3.0](./v0.3.0.md) / [한국어](./ko/v0.3.0.md) - Side-effect-free resolver, registry recovery, `RELAY_BATON_PROJECTS_FILE` override, fallback `lastError` cleanup.
- [v0.2.0](./v0.2.0.md) / [한국어](./ko/v0.2.0.md) - Project registry, project-aware commands, improved TUI dashboard, and release documentation.
- [v0.1.0](./v0.1.0.md) / [한국어](./ko/v0.1.0.md) - Initial MVP with Codex/Claude handoff, token diet, fallback detection, session files, quality gates, and auth-safe subprocess execution.
