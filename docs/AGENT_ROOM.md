# Agent Room / Conversation Mode (design)

> **Status: v0.8 first cut shipped (CLI REPL).** `relay-baton chat` (alias
> `room`) now exists as a **turn-based, confirmation-first CLI REPL** — not a
> realtime platform, not a daemon, and not the Ink TUI (which stays
> display-only per the project's safety rules). It supports the slash commands
> below, distinguishes user / claude / codex / relay-baton messages, logs to
> `conversation.jsonl`, and shows a **prompt preview + explicit confirmation
> before any real agent run**. The full conversation+context **TUI panel**
> layout in §5 is still forward-looking. See [`ROADMAP.md`](./ROADMAP.md).

## 1. Purpose

Today relay-baton is one-shot and command-driven: you run `plan`, then
`execute`, then `handoff`, each as a separate invocation. The Agent Room turns
this into an interactive, **conversational multi-agent workspace** where the
user stays in one session and directs Claude and Codex by turns — while keeping
every existing safety rail (subprocess-only, no API keys, no auto
commit/push/PR, deterministic compaction).

Goals:

- Let the user talk to **Claude** and **Codex** from inside a single
  relay-baton session, switching between them deliberately.
- Show **per-agent messages distinctly** so it is always clear who said or did
  what.
- Keep **Claude as planner/reviewer** and **Codex as executor** by default.
- Persist the exchange as a replayable, append-only event log.

## 2. UX example

```
user:    "Claude가 먼저 계획하고, 그 프롬프트를 바탕으로 Codex가 구현해"
claude:  "계획 완료. Codex에게 전달할 실행 프롬프트를 생성했습니다."
         (relay-baton: prompt preview 표시 → 사용자 확인 후 실행)
codex:   "작업 완료. 변경 파일 3개 / 테스트 결과 보고."
user:    "이번엔 Claude가 리뷰해줘"
claude:  "리뷰 완료. 위험 변경 2건과 추가 테스트 제안."
```

Equivalent English flow:

1. **user**: "Claude, plan this first; then Codex implements from that prompt."
2. **claude** (planner): "Plan ready. Generated an execution prompt for Codex."
3. **relay-baton**: shows the prompt preview; waits for user confirmation.
4. **codex** (executor): "Done. Reporting changed files + test results."
5. **user**: "Now have Claude review it."
6. **claude** (reviewer): "Review done. 2 risky changes + suggested extra tests."

## 3. Agent roles

| Agent | Default role | Responsibilities |
|---|---|---|
| **claude** | planner / reviewer | Write/refine `plan.md`; review diffs; flag risks; propose tests. |
| **codex** | executor | Implement the plan; report changed files and test results. |
| **relay-baton** | orchestrator (not an LLM) | Build prompts, show previews, enforce gates/budget, persist events. Never "speaks" as a model. |
| **user** | director | Decides who acts next; approves prompt previews; switches agents. |

Roles are defaults, not hard locks — `/agent codex` then `/plan` is allowed, but
the room nudges toward Claude=plan/review, Codex=execute.

## 4. Conversation event schema (draft)

Append-only JSON Lines at `.ai-session/conversation.jsonl`. One event per line;
never rewritten, only appended (mirrors the existing token-diet "trail"
philosophy). Draft shape:

```jsonc
{
  "id": "evt_<uuid>",
  "ts": "2026-05-29T09:40:00.000Z",
  "sessionId": "<SessionMeta.id>",
  "role": "user" | "claude" | "codex" | "relay-baton",
  "kind": "message"        // free-text turn
        | "command"        // a slash command the user issued
        | "prompt_preview" // relay-baton showing a prompt before a real run
        | "agent_run"      // an actual agent invocation (subprocess)
        | "plan"           // plan.md produced/updated
        | "execute"        // execute phase result
        | "review"         // v0.7 review output, as an event
        | "diagnose"       // v0.7 diagnose/doctor output, as an event
        | "handoff"        // handoff document produced
        | "status" | "budget",
  "text": "human-readable summary (token-diet friendly; not a full log)",
  "refs": {                 // pointers to .ai-session artifacts, not inlined blobs
    "plan": "plan.md",
    "handoff": "handoff.md",
    "diff": "full-diff.patch"
  },
  "meta": {                 // kind-specific, all optional
    "agent": "codex",
    "diet": "caveman",
    "exitCode": 0,
    "confirmed": true,      // was a prompt_preview approved before agent_run?
    "stepRefs": ["Steps#1", "Steps#3"]
  }
}
```

Schema rules (so it stays token-diet-safe):

- `text` is a **summary**, never a full diff/log — large content stays in its
  existing `.ai-session/` file and is referenced via `refs`.
- Events are **append-only**; corrections are new events, not edits.
- v0.7 only **drafts** these types and documents that `review`/`diagnose`
  results will be persisted as `review` / `diagnose` events. No writer ships in
  v0.7 beyond what review/diagnose naturally emit.

## 5. TUI layout (draft)

Two-pane layout (display-first; the input box itself is **not** built until
v0.8):

```
┌──────────────────────────────┬───────────────────────────┐
│ Conversation                 │ Context                   │
│                              │                           │
│ user   ▸ plan this first     │ mode:    plan             │
│ claude ▸ plan ready          │ plan:    ready (8 sec.)   │
│ rb     ▸ [preview] codex …   │ budget:  caveman 41%      │
│ codex  ▸ done, 3 files       │ changed: 3 files          │
│ claude ▸ review: 2 risks     │ agent:   claude (planner) │
│                              │ project: relay-baton      │
├──────────────────────────────┴───────────────────────────┤
│ > /agent codex   (confirmation-first; preview before run) │
└───────────────────────────────────────────────────────────┘
```

- **Conversation panel**: the event stream, color-coded per role.
- **Context panel**: reuses today's display-only signals (mode / plan /
  budget / changed files / active agent / project — the same data the v0.6
  `ModePanel` already shows).
- Bottom line is the (future) input + a persistent reminder that runs are
  confirmation-first.

## 6. Slash-command candidates

| Command | Effect |
|---|---|
| `/agent claude` | Switch the active agent to Claude (planner/reviewer). |
| `/agent codex` | Switch the active agent to Codex (executor). |
| `/plan` | Produce/refine `plan.md` with the current agent. |
| `/execute` | Run the executor against the current plan (preview first). |
| `/review` | v0.7 review: diff vs plan/handoff, as a `review` event. |
| `/handoff` | Build a handoff document (no-run by default). |
| `/budget` | Show context-budget usage. |
| `/status` | Show session status. |
| `/exit` | Leave the room. |

(`/continue --max-steps N` and `/replan` are **v0.9**, tied to bounded
continue mode — see ROADMAP.)

## 7. Safety policy

The Agent Room inherits and does not weaken any existing constraint:

- **Confirmation-first by default.** No agent subprocess starts without an
  explicit user confirmation.
- **Prompt preview before every real run.** The exact prompt + command is
  shown (as a `prompt_preview` event) before an `agent_run`.
- **Subprocess-only.** No direct OpenAI/Anthropic API calls; CLI session auth
  only; blocked env vars stay blocked unless `--allow-api-key-env`.
- **No auto commit / push / PR.** Ever.
- **No unbounded autopilot.** Automation is always bounded
  (`/continue --max-steps N`); there is no "run forever" mode.
- **Token-diet preserved.** Events store summaries + refs, not raw blobs.
- **No daemon in the core path.** A daemon, if it ever exists, is an opt-in
  prototype (v0.9 candidate), never required to use the room.

## 8. v0.8 minimum implementation scope

The first cut should be small and safe:

- `relay-baton chat` (alias `room`) that opens the two-pane TUI.
- Render the **conversation event stream** from `conversation.jsonl` with
  per-role labels (read + append).
- A minimal input that accepts the slash commands in §6, mapping them to the
  **existing** core operations (plan/execute/handoff/budget/status) — no new
  business logic in the TUI; it calls the same core APIs the CLI does.
- **Confirmation-first + prompt preview** wired for `/execute` and `/handoff`.
- Out of scope for v0.8: `/continue`, `/replan`, replay/resume, daemon, new
  adapters, full autopilot.

## 9. v0.9 / v1.0 expansion scope

- **v0.9**: bounded continue (`/continue --max-steps 3`), `/replan`, session
  replay/resume from `conversation.jsonl`, optional daemon prototype.
- **v1.0**: stable, project-aware Agent Room workflow; safe
  handoff/run/plan/execute/review/diagnose flow; demo gif/screenshots;
  documented real-agent end-to-end path.

---

See [`ROADMAP.md`](./ROADMAP.md) for how these phases line up with the rest of
the project.
