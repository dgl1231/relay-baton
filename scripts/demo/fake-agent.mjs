#!/usr/bin/env node
// Deterministic fake agent for demo recordings (asciinema/GIF). Prints a short
// believable work stream; in "codex" mode it ends by emitting a fallback
// pattern ("rate limit exceeded") so relay-baton relays; in "claude" mode it
// finishes cleanly. No network, no model calls, no quota spent.
const mode = process.argv[2] ?? "codex";
const lines = mode === "codex"
  ? [
      "Analyzing repository…",
      "Editing src/upload/pipeline.ts",
      "Running tests… 12 passed",
      "Editing src/upload/retry.ts",
      "ERROR: rate limit exceeded — please try again later",
    ]
  : [
      "Reading .ai-session/handoff.md…",
      "Resuming: refactor the upload pipeline (step 3/4)",
      "Editing src/upload/retry.ts",
      "Running tests… 14 passed",
      "Done.",
    ];

let i = 0;
const tick = () => {
  if (i >= lines.length) { process.exit(mode === "codex" ? 1 : 0); return; }
  console.log(lines[i++]);
  setTimeout(tick, 350);
};
tick();
