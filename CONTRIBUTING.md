# Contributing to relay-baton

Thanks for your interest! relay-baton is a local **handoff + token-diet harness**
that lets Codex CLI and Claude Code take turns on the same repo. Contributions
that fit that scope are welcome.

## Hard constraints (non-negotiable)

These are locked by `hardConstraints.test.ts` and CLAUDE.md. PRs that violate
them will not be merged:

- **No direct OpenAI/Anthropic API calls** — subprocess-only via the local
  `codex` / `claude` CLIs. No LLM API client dependency.
- **No storing/printing API keys** — provider key env vars are blocked by default
  and only passed through behind `--allow-api-key-env` (names only in audit).
- **No auto commit / push / PR**, **no daemon**, **no real-time chat platform**.
- **Deterministic compaction only** — no semantic summarization, embeddings,
  vector stores, or exact tokenizers.

## Architecture rules

- `packages/core` is UI-independent (all business logic).
- `packages/cli` and `packages/tui` call core; they hold no business logic.
- The desktop webview calls the CLI **sidecar** only — never duplicates engine
  logic, and is read-only or confirmation-first.
- New agents go through the `AgentAdapter` contract + `AgentRegistry`.

## Dev setup

```bash
pnpm install
pnpm build
pnpm test          # core + cli suites
pnpm typecheck
```

Node ≥ 20, pnpm ≥ 9. On Windows, agent spawns route through `safeSpawn`.

## Before opening a PR

1. Check the current structure; keep changes small and focused.
2. Add or update tests (`vitest`).
3. `pnpm build` and `pnpm test` must pass.
4. Update `docs/HANDOFF.md` and the relevant `docs/ROADMAP.md` checkboxes if your
   change moves a milestone.
5. Keep user-facing docs in i18n parity (en/ko/ja/zh) where applicable.

## Reporting bugs / requesting features

Use the issue templates under `.github/ISSUE_TEMPLATE/`. Include your OS, Node
version, the `codex` / `claude` CLI versions, and the exact `relay-baton …`
command. **Never paste API keys or secrets** — relay-baton's redaction is
best-effort, not a guarantee.
