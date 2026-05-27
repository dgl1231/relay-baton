# Claude Code Shared Templates

This folder stores project-shared Claude Code templates for relay-baton.

These files are kept outside `.claude/` so the repository can separate shared documentation from a developer's local Claude Code workspace.

## Files

- `commands/`: reusable Claude command prompts.
- `skills/`: Claude skill templates and related command copies.
- `AGENTS.md` / `CLAUDE.md`: Claude-oriented project guidance.

## Optional Local Copy

If you want Claude Code to load these files from a local `.claude/` folder, copy them locally:

```bash
mkdir -p .claude
cp -R docs/claude/* .claude/
```

