---
description: Compact relay-baton project context and continue with minimal but sufficient state.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

Compact the current relay-baton project context.

Goal:
- reduce unnecessary context
- preserve implementation continuity
- keep only actionable project state

Steps:
1. Read:
   - README.md
   - AGENTS.md if exists
   - CLAUDE.md if exists
   - .ai-session/state.md if exists
   - .ai-session/handoff.md if exists
   - package.json
   - pnpm-workspace.yaml
2. Inspect current git status and changed files.
3. Update `.ai-session/compact-state.md`.
4. Keep the compact state short and structured.

Use this format:

# Compact State

## Goal

## Done

## In Progress

## Remaining

## Decisions

## Risks

## Next Step

Rules:
- Do not paste full logs.
- Do not paste full diff.
- Do not repeat README content.
- Reference files instead of duplicating them.
- Keep bullets short.
- Preserve technical accuracy.