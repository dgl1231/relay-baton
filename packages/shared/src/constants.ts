export const SESSION_DIR = ".ai-session";

export const SESSION_FILES = {
  task: "task.md",
  state: "state.md",
  compactState: "compact-state.md",
  handoff: "handoff.md",
  decisions: "decisions.md",
  changedFiles: "changed-files.md",
  repoMap: "repo-map.md",
  commandsLog: "commands.log",
  errors: "errors.md",
  testResults: "test-results.md",
  fullDiff: "full-diff.patch",
  contextBudget: "context-budget.json",
  sessionJson: "session.json",
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
