# TASK (for Codex / next agent) — v1.5 git tracking & session insight

> Self-contained work order. Read this, then `git pull`. Read `AGENTS.md`,
> `docs/HANDOFF.md`, and `docs/ROADMAP.md` first. Do not start from scratch —
> v1.4 distribution polish shipped on `v1.4.0-alpha.1`.

_Authored: 2026-06-10. Target: small alpha releases from `main`._

## Context

- `relay-baton` supports git-backed workflows, but projects may also be
  non-git directories. Any git feature must degrade cleanly when no `.git`
  repository exists.
- The desktop app is a sidecar-only Tauri shell. It may call the bundled CLI,
  but it must not read `.git` or `.ai-session` directly.
- Hard constraints remain: no direct LLM API calls, no API-key storage, no
  auto commit/push/PR, no silent automation, deterministic compaction only.

## Goal

Make the app and CLI answer the practical question: **what changed in this
project while agents are working?** Start with read-only tracking, then layer
session correlation on top.

## Phase A — read-only git status snapshot

- Add a core git summary API that reports:
  - whether git is available,
  - current branch or detached commit,
  - upstream, ahead/behind counts,
  - clean/changed counts,
  - staged/unstaged/untracked counts,
  - a bounded changed-file list,
  - diff stat text.
- Add CLI command:

```bash
relay-baton git status
relay-baton git status --json
```

- Non-git projects must return a friendly unavailable state, not a hard crash.
- Desktop dashboard shows a Git panel using only the CLI sidecar.
- Agent Room supports `/git` as a read-only command.

## Phase B — session change tracking

- [x] Record a lightweight git snapshot at session start:
  - branch,
  - HEAD,
  - changed file count,
  - dirty/clean state.
- [x] Show whether the working tree changed since the current session began.
- [x] Store the snapshot under `.ai-session/` as a small JSON file; do not inline
  full diffs into chat or handoff output.

## Phase C — handoff and review integration

- [x] Include the bounded git summary in `status --json` and handoff context.
- [x] Let `review --json` include git tracking fields so the desktop can show:
  - files touched by the plan,
  - files changed outside the plan,
  - whether untracked files exist.
- [x] Keep full diff references in `.ai-session/full-diff.patch`; do not duplicate
  large diff bodies.

## Acceptance criteria

- [x] `relay-baton git status --json` works in git and non-git projects.
- [x] Desktop dashboard shows a Git panel and `/git` appends a read-only result
      to the Agent Room timeline.
- [x] Non-git registered projects remain valid and show git unavailable.
- [x] `.ai-session/git-baseline.json` is created on init and `git status --json`
      reports whether the repo changed since that baseline.
- [x] `corepack pnpm build` and `corepack pnpm test` pass.
- [x] Docs updated: ROADMAP, release notes when cutting an alpha, HANDOFF if
      there is carry-over.

## Out of scope

- Auto commit / push / PR.
- Branch creation, checkout, merge, reset, stash, or any other git write.
- Daemon-style file watching.
- Reading `.git` directly from the desktop webview.
