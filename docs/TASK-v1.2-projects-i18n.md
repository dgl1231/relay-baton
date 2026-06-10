# TASK (for Codex) — v1.2 desktop: project management + i18n

> Self-contained work order. Read this, then `git pull`. Do **not** start from
> scratch — the v1.2 desktop GUI already exists and works. You are adding two
> features to it. Also read `CLAUDE.md` and `docs/HANDOFF.md` first.

_Authored: 2026-06-10. Target branch: cut `feat/v1.2-projects-i18n` from `main`._

## Context (where things are)

- v1.2 desktop GUI shipped as `v1.2.0-alpha.2` (tag on `main`). The Tauri app
  launches and the webview now reaches the CLI **sidecar** correctly
  (`app.withGlobalTauri: true` + `window.__TAURI__` — do NOT reintroduce bare
  `import("@tauri-apps/...")`, they do not resolve in the no-bundler frontend).
- The desktop app is a **thin shell over the relay-baton CLI**. The dashboard
  (`desktop/ui/index.html`) reads everything through the bundled CLI sidecar:
  `status --json`, `budget --json`, `project list/current --json`,
  `handoff show`, `replay --json`. It already has a project-switch dropdown, a
  diet selector, a light/dark toggle, keyboard shortcuts, and a read-only
  agent-room timeline.
- Project registry lives at `~/.relay-baton/projects.json`; CLI commands:
  `project add <path>`, `project switch <name-or-id>`, `project list`,
  `project current`, `project remove <name-or-id>` (see
  `packages/cli/src/commands/project.ts`, `packages/core/src/projects/`).

## Hard constraints (unchanged — from CLAUDE.md)

- GUI calls the CLI sidecar **only**; no business logic in the webview; it never
  reads/writes `.ai-session/` or `projects.json` directly.
- No direct OpenAI/Anthropic API calls; no API-key storage; no auto
  commit/push/PR. Read-only or confirmation-first.
- Keep `desktop/` outside the pnpm workspace. TypeScript build/test CI must stay
  green (`corepack pnpm build`, `corepack pnpm test`).

## Feature 1 — Project management in the GUI

Today the GUI can only **switch** among already-registered projects. Make it so
a user can **add** and **remove** projects too. Provide BOTH entry paths
(decision is final):

1. **Native folder picker** — a `+ Project` button in the header opens the OS
   folder-selection dialog; the chosen path is passed to `project add <path>`.
   - Use the Tauri **dialog** plugin (`tauri-plugin-dialog`, v2). Wire it like
     the existing shell plugin:
     - `desktop/src-tauri/Cargo.toml`: add `tauri-plugin-dialog = "2"`.
     - `desktop/src-tauri/src/lib.rs`: `.plugin(tauri_plugin_dialog::init())`.
     - `desktop/src-tauri/capabilities/default.json`: add `"dialog:default"`
       (and `dialog:allow-open` if needed) to `permissions`.
     - In the webview call it via the global API:
       `window.__TAURI__.dialog.open({ directory: true })`.
2. **Direct path input** — a small text field + `Add` button next to it; submit
   runs `project add <typed path>`. No new dependency. Trim/validate empty.

After a successful add/switch/remove, refresh the project dropdown and all
panels (reuse the existing `loadProjects()` + `refresh()`).

Also add a **Remove** affordance for the active/selected project (calls
`project remove <name-or-id>`), with a confirmation step (mirror the existing
confirm-palette pattern; do not delete without confirm).

Notes / gotchas:
- `project add` may print a human line, not JSON. If you need structured output,
  check whether the command supports `--json`; if not, either add a `--json`
  variant (CLI, with a test) OR parse the exit code + re-run `project list
  --json` to refresh. Prefer adding `--json` to `project add`/`remove` for a
  clean UI contract, following the existing `--json` commands as a model, and
  add cli tests like `packages/cli/src/__tests__/projectJson.test.ts`.
- The dropdown currently shows `(unavailable)` when `project list --json`
  throws; keep that graceful fallback.

## Feature 2 — App language (i18n)

Add a language selector to the header. **Default English**, plus **Korean,
Japanese, Chinese (Simplified)** — 4 locales total: `en` (default), `ko`, `ja`,
`zh`.

- This is **UI-chrome translation only** (labels, buttons, panel headings,
  help-overlay text, the "not running inside Tauri" message, etc.). Do NOT
  translate CLI output that flows through the sidecar — that is the CLI's data,
  shown as-is.
- Implementation (keep it dependency-free, vanilla):
  - A `STRINGS` object in `ui/index.html`: `{ en: {...}, ko: {...}, ja: {...},
    zh: {...} }` keyed by short ids (e.g. `status`, `budget`, `handoff`,
    `refresh`, `project`, `diet`, `addProject`, `removeProject`,
    `shortcutsTitle`, `notInTauri`, ...).
  - A `t(key)` helper; on language change, re-render static text (set
    `textContent` on the labelled elements) — give each translatable element a
    stable `id` or `data-i18n` attribute and a single `applyLang()` pass.
  - Persist the choice in `localStorage` (`rb-lang`); default to `en` if unset.
    (Optionally seed from `navigator.language` on first run, still defaulting to
    `en` for anything outside the 4.)
  - Header `<select id="lang">` with `English / 한국어 / 日本語 / 中文`.
- Keep keyboard shortcuts working regardless of language (they are keys, not
  labels), but translate the help-overlay descriptions.

## Acceptance criteria

- [ ] From the GUI: add a project via folder picker AND via path input; switch
      active project; remove a project (with confirm). Dropdown + panels refresh
      after each.
- [ ] Language selector switches all UI chrome between en/ko/ja/zh and persists
      across relaunch. Default is English.
- [ ] CLI sidecar contract stays clean (`--json` where the UI needs structured
      data); new CLI flags have vitest coverage.
- [ ] `corepack pnpm build` + `corepack pnpm test` green. `node --check` on the
      extracted `ui/index.html` module passes.
- [ ] Hard constraints intact (sidecar-only, no `.ai-session`/registry writes
      from the webview, confirmation-first for destructive `project remove`).
- [ ] Docs updated: `docs/ROADMAP.md` (note these under v1.2 or v1.3), 
      `docs/HANDOFF.md` (state + date), `desktop/README.md` (features), and a
      release note when tagging.

## Build / verify / release

- This dev machine note (from HANDOFF): use `corepack pnpm …` (pnpm not on
  PATH). On the machine with a **Rust toolchain**, verify the Tauri side:
  `cd desktop && npm install && npm run dev` (needs the staged sidecar — run
  `npm run stage-sidecar -- --from <a relay-baton CLI binary>` first; or
  download the latest release binary).
- `gh` is available on the Windows box (logged in as dgl1231) but may be
  unusable elsewhere — re-check per machine.
- Release/runbook + the hard-won CI gotchas (incl. **MSI rejects non-numeric
  prerelease versions → keep `tauri.conf.json` version a plain `x.y.z`**) are in
  `docs/RELEASE.md`. When ready, cut `v1.2.0-alpha.3` (or `v1.2.0`) the same way
  earlier alphas were cut.

## Out of scope

- No new agent-run capability from the GUI (it stays read-only /
  confirmation-first). No translating CLI output. No settings file beyond
  `localStorage`. No auto commit/push/PR — the human drives merges/tags.
