export const SESSION_DIR = ".ai-session";

/**
 * v1.0 stability contract. These are the frozen schema versions for the two
 * persisted contracts relay-baton owns. Bump ONLY on a breaking shape change;
 * loaders normalize older payloads up to the current version.
 */
export const CONFIG_VERSION = 1;
export const SESSION_SCHEMA_VERSION = 1;

export const SESSION_FILES = {
  task: "task.md",
  state: "state.md",
  compactState: "compact-state.md",
  handoff: "handoff.md",
  plan: "plan.md",
  decisions: "decisions.md",
  changedFiles: "changed-files.md",
  repoMap: "repo-map.md",
  commandsLog: "commands.log",
  errors: "errors.md",
  testResults: "test-results.md",
  fullDiff: "full-diff.patch",
  contextBudget: "context-budget.json",
  gitBaseline: "git-baseline.json",
  sessionJson: "session.json",
  // v0.7 — append-only conversation event log (Agent Room groundwork).
  conversation: "conversation.jsonl",
} as const;

export const TRUNCATE_MARKER =
  "[TRUNCATED by relay-baton token diet: original content exceeded section budget]";

export const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "bin",
  "obj",
  "dist",
  "build",
  ".next",
  ".turbo",
  "coverage",
  ".ai-session",
]);

export const SKIP_DIFF_PATTERNS = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /\.min\.js$/,
];
