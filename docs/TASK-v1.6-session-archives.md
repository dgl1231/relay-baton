# TASK (for Claude / next agent) — v1.6 session archives & recovery

> Self-contained work order. Read this, then `git pull`. Start with
> `docs/HANDOFF.md`, `docs/ROADMAP.md`, and this file. Do not restart v1.5; it
> is already tagged through `v1.5.0-alpha.1`.

_Authored: 2026-06-11. Status: first cut started on `main` after
`v1.5.0-alpha.1`._

## Context

- v1.5 shipped read-only git tracking and session baselines.
- v1.5.0-alpha.1 closed the v1.4 deferred desktop updater item.
- v1.6 theme is preserving completed/interrupted work across projects and
  desktop sessions.
- Hard constraints remain: no direct LLM API calls, no API-key storage, no auto
  commit/push/PR, no silent automation, deterministic compaction only.

## Already implemented

- Core `SessionArchiver`:
  - copies the current `.ai-session/` tree into a timestamped directory under
    `~/.relay-baton/session-archives` by default,
  - writes `manifest.json`,
  - records per-file size and SHA-256,
  - supports `dryRun`,
  - leaves source repository files untouched.
- CLI command:

```bash
relay-baton session archive
relay-baton session archive --json
relay-baton session archive --dry-run
relay-baton session archive --out <dir>
```

- Tests:
  - `packages/core/src/__tests__/SessionArchiver.test.ts`
  - `packages/cli/src/__tests__/sessionArchive.test.ts`
- Docs:
  - `docs/COMMANDS.md`
  - `docs/i18n/COMMANDS.ko.md`
  - `docs/ROADMAP.md`

## Validation already run

```bash
corepack pnpm build
corepack pnpm test
node packages/cli/dist/index.js session archive --dry-run --json --path .
git diff --check
```

All passed. `git diff --check` only emitted line-ending warnings on Windows.

## Next recommended steps

1. Add `relay-baton session list --json`.
   - Read archive directories under `~/.relay-baton/session-archives`.
   - Parse each `manifest.json`.
   - Sort newest first.
   - Degrade cleanly if the archive root does not exist.
2. Add `relay-baton session inspect <archive-id|path> --json`.
   - Validate manifest shape.
   - Report file count, total bytes, repoRoot, createdAt, and missing files.
   - Do not copy/apply anything.
3. Add resume diagnostics.
   - Detect current `.ai-session` missing/incomplete/stale.
   - Suggest one of `status`, `review`, `handoff`, `replay`, `verify`, or
     `session archive`.
4. Desktop follow-up.
   - Read-only archive list panel through CLI sidecar only.
   - No direct `.ai-session` or archive-dir reads from the webview.
5. Later only: zip/export/prune.
   - Keep pruning disabled by default.
   - Prune must have dry-run first.

## Acceptance criteria for v1.6

- [x] First-cut `session archive` command exists and is tested.
- [x] `session list --json` lists archives.
- [x] `session inspect --json` validates a selected archive.
- [x] Resume diagnostics suggest safe next commands.
- [x] Desktop can browse archives read-only through the CLI sidecar.
- [x] Archive integrity checks are documented and tested.
- [ ] `corepack pnpm build` and `corepack pnpm test` stay green.

## Out of scope

- Cloud upload.
- Auto restore/apply.
- Destructive prune without dry-run.
- Zip/bundle format as the only archive representation.
- Any direct desktop file access bypassing the CLI sidecar.
