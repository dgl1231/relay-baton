export const SESSION_DIR = ".ai-session";

/**
 * v2.6 multi-session workspace. Named work items live under
 * `.ai-session/sessions/<name>/`; the legacy flat `.ai-session/` IS the
 * `default` work item (so existing repos need no migration). The active pointer
 * + work-item list live in `.ai-session/workspace.json`.
 */
export const WORKSPACE_FILE = "workspace.json";
export const SESSIONS_SUBDIR = "sessions";
export const DEFAULT_SESSION = "default";

/**
 * v1.0 stability contract. These are the frozen schema versions for the two
 * persisted contracts relay-baton owns. Bump ONLY on a breaking shape change;
 * loaders normalize older payloads up to the current version.
 */
export const CONFIG_VERSION = 1;
export const SESSION_SCHEMA_VERSION = 1;

/**
 * v2.0 artifact schema registry. Current on-disk schema version for each
 * versioned artifact relay-baton owns. The migration tooling (`migrate
 * --check`, `doctor --deep`) compares what it finds on disk against these.
 * Bump a value ONLY on a breaking shape change and register a migrator.
 * Artifacts without a schemaVersion field are treated as legacy v1.
 */
export const ARTIFACT_SCHEMA_VERSIONS = {
  sessionJson: 1,
  checkpoints: 1,
  gitBaseline: 1,
  conversation: 1,
} as const;

export type VersionedArtifact = keyof typeof ARTIFACT_SCHEMA_VERSIONS;

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
  // v1.7 — append-only execution checkpoints (guarded execution workflow).
  checkpoints: "checkpoints.jsonl",
  // v2.4 — append-only local usage ledger (token/quota proxy; never transmitted).
  usage: "usage.jsonl",
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
