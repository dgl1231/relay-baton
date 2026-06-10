# TASK (for Codex) — v1.3 desktop chat + project-scoped sessions

> Self-contained work order. This is planning/spec work for the next desktop
> iteration after `v1.2.0-alpha.3`. Read this with `AGENTS.md`, `CLAUDE.md`,
> `docs/AGENT_ROOM.md`, `docs/ROADMAP.md`, and `desktop/README.md`.

_Authored: 2026-06-10. Target: v1.3 candidate._

## User request

The current desktop app can show the Agent Room timeline, but actual
conversation/check workflows still live in the CLI (`relay-baton chat` /
`relay-baton room`). The user wants the desktop app to support talking/checking
inside the app too, and wants app sessions to be clearly separated per project.

## Current state

- Desktop GUI is a Tauri webview in `desktop/ui/index.html`.
- It is intentionally a thin shell over the bundled `relay-baton` CLI sidecar.
- It already supports project add/switch/remove, status/budget/handoff panels,
  read-only `replay --json` timeline, confirmation-first actions, and UI i18n.
- It does **not** currently provide an input chat box in the desktop app.
- It does **not** currently expose a session list/switcher per project.

## Hard constraints

- Keep the desktop app sidecar-only. Do not move core business logic into the
  webview.
- No direct OpenAI/Anthropic API calls.
- No API-key storage in the app.
- No auto commit/push/PR.
- No unbounded autopilot. Any real agent execution must be confirmation-first,
  with prompt/command preview.
- Do not make the app a daemon or realtime chat service in v1.3.
- Preserve CLI behavior. The CLI remains the source of truth.

## Feature 1 — Desktop conversation/check UI

Add an in-app conversation panel that lets the user interact with the existing
Agent Room concepts without leaving the desktop app.

Recommended scope:

- Add a text input/composer under the existing `agent room` timeline.
- Support slash-command style actions first, rather than open-ended realtime
  chat:
  - `/status`
  - `/budget`
  - `/review`
  - `/diagnose`
  - `/replay`
  - `/plan <task>` as preview/confirm only
  - `/execute` as preview/confirm only
  - `/handoff` as preview/confirm only
- Read-only commands may run through the CLI sidecar and append/render output in
  the timeline.
- Agent-launching commands must show a confirmation card with the exact command
  and prompt/intent before execution. If v1.3 cannot safely stream/drive the
  interactive confirmation flow, keep those as copy-to-terminal previews.

Implementation guidance:

- Prefer adding CLI JSON/NDJSON surfaces where the desktop needs structured
  output. Do not parse human output if a small CLI JSON mode is reasonable.
- The webview should call the sidecar only, for example:
  - `relay-baton status --json`
  - `relay-baton budget --json`
  - `relay-baton review --json`
  - `relay-baton doctor --deep`
  - `relay-baton replay --json`
- If an actual in-app chat command needs to append a user message, add a small
  CLI command for that rather than writing `.ai-session/conversation.jsonl`
  directly from the webview.
- Keep the UI transparent: show whether something is read-only, preview-only,
  or actually executing.

Out of scope for v1.3:

- Direct model APIs.
- Arbitrary long-running interactive terminal emulation in the webview.
- Background daemon.
- Auto-continue without an explicit max step limit.
- Auto commit/push/PR.

## Feature 2 — Project-scoped desktop sessions

Make sessions in the desktop app clearly scoped by project.

Problem:

- relay-baton stores runtime artifacts under each project root's `.ai-session/`.
- The desktop app can switch projects, but it does not yet present sessions as a
  project-scoped concept. Users should not wonder which project a timeline,
  status, or handoff belongs to.

Recommended scope:

- Treat each registered project as the top-level session scope.
- On project switch, refresh all session-bound panels: status, budget, handoff,
  conversation timeline, and action/composer context.
- Display active project name/path prominently near the conversation panel.
- Add an explicit session state indicator:
  - no `.ai-session` yet
  - initialized
  - planning
  - executing
  - handoff ready
  - failed/completed
- Add a project-scoped session list only if a stable backing model exists.
  Current `.ai-session/session.json` is the active session; historical sessions
  may need a new index before the desktop can list them reliably.

Potential CLI support:

- `relay-baton session current --json`
- `relay-baton session list --json --project <name-or-id>`
- `relay-baton session init --project <name-or-id>` or reuse `init --project`
- `relay-baton conversation append --json ...` if desktop needs to append user
  messages safely.

Keep this conservative:

- Do not make the webview read/write `.ai-session` files directly.
- Do not invent a hidden desktop-only session store.
- If session history is added, keep it in CLI/core and expose it through JSON.

## UX proposal

```text
Header:
  relay-baton | Project: [project dropdown] [+ Project] [Remove] | Language | Theme | Refresh

Main:
  Left/Top: status + budget + handoff cards
  Agent Room:
    - active project badge
    - session state badge
    - timeline
    - composer input
    - command/action suggestions
    - confirmation preview card
```

Composer behavior:

- Plain text can be recorded as a user note only if a CLI append command exists.
- Slash commands run or preview existing relay-baton commands.
- Disable the composer when no project is selected.
- Show a clear message when the selected project has no `.ai-session` yet, with
  an `Init session` action that calls `relay-baton init --project <id>`.

## Acceptance criteria

- Desktop app has a visible conversation/composer area, not only a read-only
  replay timeline.
- User can run/check at least read-only commands (`status`, `budget`, `review`,
  `diagnose`, `replay`) from the app and see results in context.
- Agent-launching actions remain confirmation-first and never silently run.
- Switching projects refreshes and clearly scopes all displayed session data.
- No desktop-only direct writes to `.ai-session` or `projects.json`.
- New CLI JSON/session commands, if added, have Vitest coverage.
- `corepack pnpm build` and `corepack pnpm test` pass.
- Tauri-side behavior is verified on a Rust toolchain machine.

## Notes for the implementing agent

- Do not regress `v1.2.0-alpha.3`: project add should remain folder-picker only
  in the desktop UI, while CLI `project add <path>` still accepts directories.
- Keep i18n in sync for any new UI chrome.
- Preserve the current no-bundler frontend rule: use `window.__TAURI__`, not
  bare `@tauri-apps/...` imports.
