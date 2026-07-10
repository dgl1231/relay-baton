#!/usr/bin/env bash
# Record-ready relay-baton demo: shows detect -> compact handoff -> baton pass
# using deterministic fake agents (no real codex/claude run, no quota).
#
# Record with:   asciinema rec -c "bash scripts/demo/demo.sh" demo.cast
# Or GIF:        agg demo.cast demo.gif   (https://github.com/asciinema/agg)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# Git Bash on Windows: node.exe cannot resolve /c/... paths — use C:/... form.
command -v cygpath >/dev/null 2>&1 && ROOT="$(cygpath -m "$ROOT")"
CLI="$ROOT/packages/cli/dist/index.js"
[ -f "$CLI" ] || { echo "build first: pnpm build"; exit 1; }

DEMO="$(mktemp -d "${TMPDIR:-/tmp}/relay-baton-demo-XXXXXX")"
trap 'rm -rf "$DEMO"' EXIT
cd "$DEMO"
git init -q && git config user.email demo@example.com && git config user.name demo
mkdir -p src/upload && echo "export const todo = true;" > src/upload/pipeline.ts
git add -A && git commit -qm "seed"

# Fake agents: "codex" streams work then hits a rate limit; "claude" resumes
# from the handoff and finishes. Subprocess-only, exactly like real adapters.
cat > relay-baton.config.json <<CFG
{
  "agents": {
    "codex":  { "command": "node", "args": ["$ROOT/scripts/demo/fake-agent.mjs", "codex"] },
    "claude": { "command": "node", "args": ["$ROOT/scripts/demo/fake-agent.mjs", "claude"] }
  }
}
CFG

echo "\$ relay-baton run \"refactor the upload pipeline\" --diet caveman"
sleep 1
node "$CLI" run "refactor the upload pipeline" --diet caveman --path . --force
echo
echo "\$ relay-baton status"
node "$CLI" status --path .
