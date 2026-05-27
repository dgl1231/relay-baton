```md
---
description: Review relay-baton implementation for architecture, token diet behavior, fallback safety, and MVP scope control.
allowed-tools: Read, Grep, Glob, Bash
---

Review the current relay-baton implementation.

Focus on:

1. Architecture
- core is UI-independent
- cli only calls core
- tui does not own business logic
- AgentAdapter separation is clean

2. Token Diet
- handoff.md avoids full-context dumps
- full diff is stored as full-diff.patch
- full logs stay in commands.log
- compact-state.md is used
- caveman profile is professional and concise
- profile budgets are enforced

3. Auth Safety
- no direct OpenAI/Anthropic API calls
- no API key storage
- no API key logging
- API key env vars are blocked by default
- --allow-api-key-env is explicit

4. Fallback Flow
- Codex output is streamed and logged
- fallback patterns are detected case-insensitively
- handoff is generated before Claude launch
- quality gates run before fallback agent

5. MVP Scope
- no daemon
- no VS Code extension
- no Visual Studio extension
- no tmux manager
- no auto commit/push/PR
- no semantic summarization

Return:
- Critical issues
- Suggested fixes
- Missing tests
- Files to inspect next