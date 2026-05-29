# `.ai-session/` Artifacts (v1.0 stability contract)

relay-baton writes all session state under `.ai-session/` in the target
repository. This document is the v1.0 stability contract for those artifacts:
which files exist, what shape they hold, and what relay-baton guarantees.

The contract is enforced by two frozen schema versions in
`@relay-baton/shared`:

- `CONFIG_VERSION = 1` — `relay-baton.config.json` shape.
- `SESSION_SCHEMA_VERSION = 1` — `session.json` (`SessionMeta`) shape.

Loaders normalize older payloads up to the current version. These numbers bump
**only** on a breaking shape change.

## Files

| File | Format | Validated shape | Notes |
| --- | --- | --- | --- |
| `session.json` | JSON | `SessionMeta` (`validateSessionMeta`) | Authoritative session metadata. Strict. |
| `context-budget.json` | JSON | Any valid JSON object | Token-diet budget snapshot. Empty → warning. |
| `conversation.jsonl` | JSONL | One JSON value per non-empty line | Append-only Agent Room event log. |
| `task.md` | Markdown | existence only | Free-form. |
| `state.md` | Markdown | existence only | Free-form. |
| `compact-state.md` | Markdown | existence only | Free-form. |
| `handoff.md` | Markdown | existence only | Free-form, budget-bounded. |
| `plan.md` | Markdown | existence only | Section structure checked by `doctor --deep`. |
| `decisions.md` | Markdown | existence only | Free-form. |
| `changed-files.md` | Markdown | existence only | Free-form. |
| `repo-map.md` | Markdown | existence only | Free-form. |
| `commands.log` | text | existence only | Append-only command log. |
| `errors.md` | Markdown | existence only | Free-form. |
| `test-results.md` | Markdown | existence only | Free-form. |
| `full-diff.patch` | patch | existence only | Raw diff; never inlined into handoff. |

## Validation

`validateArtifacts(repoRoot)` (in `@relay-baton/core`) performs a deterministic,
read-only shape check:

- **`session.json`** must parse as JSON and satisfy the `SessionMeta` contract.
- **`context-budget.json`** must parse as JSON when present; empty content is a
  warning, not a failure.
- **`conversation.jsonl`** — every non-empty line must be valid JSON.
- **Markdown artifacts** are intentionally free-form; only existence is noted.

Each artifact yields an `ArtifactCheck { artifact, file, status, detail }` where
`status` is `ok` | `warn` | `fail` | `absent`. The overall report is `ok` unless
any check is `fail`. The validator never mutates and never spawns.

Run it via the CLI:

```
relay-baton doctor --deep
```

`doctor --deep` reports both the config contract (`validateConfig`) and the
artifact shapes (`validateArtifacts`).

## Guarantees

- relay-baton never writes API keys or secrets into any `.ai-session/` file.
- The two JSON contracts (`session.json`, `context-budget.json`) and the JSONL
  log are forward-compatible within a major version; unknown fields are
  preserved on read where practical and ignored by validation.
- A missing `.ai-session/` directory is valid (uninitialized repo) and reports
  `ok`.
