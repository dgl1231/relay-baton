# relay-baton Roadmap

relay-baton is a local handoff + token-diet harness that lets Codex CLI and
Claude Code take turns on the same repository without pasting whole logs,
diffs, or repos between them.

This roadmap is directional, not a contract. Versions ship when their theme is
solid; items can slip forward. Hard constraints never change: **no direct
OpenAI/Anthropic API calls, no storing/printing API keys, no auto
commit/push/PR, deterministic compaction only.**

## Shipped

- **v0.1** — MVP: Codex→Claude handoff, token diet, fallback detection, session
  files, quality gates, auth-safe subprocess execution.
- **v0.2** — Project registry, project-aware commands, TUI dashboard.
- **v0.3** — Side-effect-free resolver, registry recovery, env override.
- **v0.4** — GitHub Actions CI, critical-path tests, CLI smoke test, session
  observability, `handoff history`.
- **v0.5** — Plan-execute mode (`plan` / `execute`, planner→executor,
  PlanQualityGate) + context-compression mode (`compress-context`).

## v0.6 — Trust & Verify (current)

Make the existing pipeline provable and observable before adding surface area.

- `doctor --deep` — extended environment diagnostics (tool versions, adapter
  args sanity, deprecated-arg warnings, CRLF/.gitattributes hints, registry +
  `.ai-session` health, latest handoff budget / plan / compression status).
- `verify` — simulated end-to-end pass with **no real model calls**: repo
  resolution, fallback detection, handoff no-run, token budget, API-key env
  block. `--real-agents` is scaffold only.
- TUI mode panel — display current mode, plan status, compression status, and
  latest handoff (display only; the TUI never launches agents).
- Docs — README plan/execute/compress-context workflow, this roadmap,
  consolidated verification commands.

## v0.7 — Review & Diagnose

Help the human (and the next agent) understand what changed and why.

- `review` — deterministic summary of the current diff against the plan /
  handoff (no model call): which plan Steps are touched, which are untouched.
- Plan execution receipts — executor marks `plan.md` Steps `[done]`/`[skipped]`
  (append-only markers, never rewriting step text).
- Plan diffing — re-plan shows a delta against the previous `plan.md` instead
  of a full rewrite; prior kept as `plan.<ts>.md`.
- Richer `status` / `budget` output and machine-readable (`--json`) variants.
- **Conversation event schema (draft)** — design the append-only event log
  (`.ai-session/conversation.jsonl`) that future versions use to record who
  said/did what (user / claude / codex / relay-baton). Documentation + draft
  types only; no chat command this version. See
  [`docs/AGENT_ROOM.md`](./AGENT_ROOM.md).
- **`review`/`diagnose` as conversation events** — document the direction that
  review/diagnose results are persisted as conversation events so the eventual
  Agent Room can replay them. Direction doc only this version.

## v0.8 — Adapter Expansion + Agent Room (first cut)

Grow beyond Codex/Claude only when a real user needs it, and stand up the
first interactive multi-agent "room".

- OpenCode / Gemini / Aider adapter scaffolds — each is `<Name>Adapter.ts` + a
  mirror test + a README row.
- Project-level fallback-pattern overrides (`BatonProject.fallbackPatterns?`
  overlays global).
- macOS / Windows CI matrix (`matrix.os`) — expect Windows path/EOL fixes.
- **Agent Room / Conversation Mode (first implementation)** — see
  [`docs/AGENT_ROOM.md`](./AGENT_ROOM.md):
  - `relay-baton chat` (alias `relay-baton room`) entry point.
  - Distinct, labeled messages for **user / claude / codex / relay-baton**.
  - Claude as planner/reviewer, Codex as executor.
  - TUI shaped as a **conversation panel + context panel**.
  - Slash-command candidates: `/agent claude`, `/agent codex`, `/plan`,
    `/execute`, `/review`, `/handoff`, `/budget`, `/status`, `/exit`.
  - **Confirmation-first by default**, with a **prompt preview before any real
    agent run**.

## v0.9 — Automation & Runtime

Carefully add bounded automation while keeping the safety rails.

- Multi-turn plan↔execute loop with a budget guard (capped iterations to avoid
  token runaway); divergence captured to `errors.md`.
- Adaptive per-model compression thresholds and cross-session archiving.
- Optional non-interactive `run --until` orchestration (still no
  auto-commit/push/PR; still subprocess-only).
- **Agent Room + bounded continue** — wire the room into bounded automation
  (see [`docs/AGENT_ROOM.md`](./AGENT_ROOM.md)):
  - `/continue --max-steps 3` (bounded, never unbounded autopilot).
  - `/replan` from inside the room.
  - Session replay / resume from `conversation.jsonl`.
  - A daemon prototype is a *candidate* for this stage, not a commitment.

## v1.0 — Stable Local Release

- Frozen, documented config schema and SessionMeta contract.
- Full command reference + i18n parity across supported languages.
- Stability/compatibility guarantees for `.ai-session/` artifacts.
- Polished TUI and a complete `doctor`/`verify` health story.
- **Stable, project-aware Agent Room workflow** (see
  [`docs/AGENT_ROOM.md`](./AGENT_ROOM.md)):
  - Safe handoff / run / plan / execute / review / diagnose flow inside the room.
  - Demo gif / screenshots.
  - Real-agent end-to-end documentation (`verify --real-agents` graduated from
    scaffold to a documented, opt-in path).

## Permanently out of scope

- Direct LLM API client / self-hosted inference.
- Auto commit / push / PR.
- Real-time agent chat / DM platform.
- IDE extensions, daemons, tmux managers.
- Semantic summarization or exact tokenizers (deterministic compaction only).
