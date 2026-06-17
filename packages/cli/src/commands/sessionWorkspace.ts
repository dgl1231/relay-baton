import * as path from "path";
import * as fs from "fs";
import { ConfigLoader, SessionManager, WorkspaceManager, GitService } from "@relay-baton/core";
import { isAgentId } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface SessionWorkOpts extends ProjectOpts {
  json?: boolean;
  switch?: boolean;
  agent?: string;
  init?: boolean;
  deleteFiles?: boolean;
  branch?: string;
  worktreePath?: string;
  force?: boolean;
}

/** Default isolated worktree location: `<parent>/<repo>.worktrees/<name>`. */
function defaultWorktreePath(repoRoot: string, name: string): string {
  return path.join(path.dirname(repoRoot), `${path.basename(repoRoot)}.worktrees`, name);
}

/** `session new <name>` — create a named work item (optionally switch + init). */
export async function sessionNewCommand(name: string, opts: SessionWorkOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const { config } = ConfigLoader.load(repoRoot);
  const wm = new WorkspaceManager(repoRoot);

  if (opts.agent && !isAgentId(opts.agent)) {
    console.error(`[relay-baton] unknown agent: ${opts.agent}`);
    process.exit(2);
  }

  try {
    wm.create(name, { assignedAgent: opts.agent as any, activate: opts.switch });
  } catch (e: any) {
    console.error(`[relay-baton] ${e?.message ?? e}`);
    process.exit(2);
  }

  // Initialize the new work item's .ai-session artifacts (default: yes).
  if (opts.init !== false) new SessionManager(repoRoot, config, name).init("");

  if (opts.json) {
    console.log(JSON.stringify(wm.load(), null, 2));
    return;
  }
  console.log(`[relay-baton] created session "${name}"${opts.agent ? ` (agent: ${opts.agent})` : ""}${opts.switch ? " and switched to it" : ""}.`);
  if (!opts.switch) console.log(`  → activate with: relay-baton session switch ${name}`);
}

/** `session switch|use <name>` — set the active work item. */
export async function sessionSwitchCommand(name: string, opts: SessionWorkOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  ConfigLoader.load(repoRoot);
  const wm = new WorkspaceManager(repoRoot);
  try {
    wm.switchTo(name);
  } catch (e: any) {
    console.error(`[relay-baton] ${e?.message ?? e}`);
    process.exit(2);
  }
  if (opts.json) { console.log(JSON.stringify(wm.load(), null, 2)); return; }
  console.log(`[relay-baton] active session → ${name}`);
}

/** `session items` — list work items in this repo (read-only). */
export async function sessionItemsCommand(opts: SessionWorkOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  ConfigLoader.load(repoRoot);
  const wm = new WorkspaceManager(repoRoot);
  const ws = wm.load();

  if (opts.json) { console.log(JSON.stringify(ws, null, 2)); return; }
  console.log(`[relay-baton] sessions (active: ${ws.active})`);
  for (const s of ws.sessions) {
    const mark = s.name === ws.active ? "*" : " ";
    const agent = s.assignedAgent ? ` [${s.assignedAgent}]` : "";
    console.log(`  ${mark} ${s.name}${agent}`);
  }
}

/** `session assign <name> <agent>` — pin a work item to an agent (v2.6 item 2 groundwork). */
export async function sessionAssignCommand(name: string, agent: string, opts: SessionWorkOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  ConfigLoader.load(repoRoot);
  if (agent !== "none" && !isAgentId(agent)) {
    console.error(`[relay-baton] unknown agent: ${agent} (use an agent id or "none")`);
    process.exit(2);
  }
  const wm = new WorkspaceManager(repoRoot);
  try {
    wm.assignAgent(name, agent === "none" ? undefined : (agent as any));
  } catch (e: any) {
    console.error(`[relay-baton] ${e?.message ?? e}`);
    process.exit(2);
  }
  console.log(`[relay-baton] session "${name}" agent → ${agent}`);
}

/** `session worktree add <name>` — back a work item with an isolated git worktree. */
export async function sessionWorktreeAddCommand(name: string, opts: SessionWorkOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  ConfigLoader.load(repoRoot);
  const wm = new WorkspaceManager(repoRoot);
  if (!wm.has(name)) {
    console.error(`[relay-baton] unknown session: ${name} (create it first with \`session new ${name}\`)`);
    process.exit(2);
  }
  const git = new GitService(repoRoot);
  if (!git.isGitRepo()) {
    console.error("[relay-baton] not a git repository. worktrees require git.");
    process.exit(2);
  }
  const dir = opts.worktreePath ? path.resolve(opts.worktreePath) : defaultWorktreePath(repoRoot, name);
  if (fs.existsSync(dir)) {
    console.error(`[relay-baton] worktree path already exists: ${dir}`);
    process.exit(2);
  }
  const branch = opts.branch ?? `relay/${name}`;
  const res = git.addWorktree(dir, branch);
  if (!res.ok) {
    console.error(`[relay-baton] git worktree add failed: ${res.error}`);
    process.exit(1);
  }
  wm.setWorktree(name, dir);
  console.log(`[relay-baton] worktree for "${name}" → ${dir} (branch ${branch})`);
  console.log(`  run/handoff for "${name}" now execute in this isolated checkout.`);
}

/** `session worktree remove <name>` — detach + remove the work item's worktree. */
export async function sessionWorktreeRemoveCommand(name: string, opts: SessionWorkOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  ConfigLoader.load(repoRoot);
  const wm = new WorkspaceManager(repoRoot);
  const entry = wm.load().sessions.find(s => s.name === name);
  if (!entry?.worktree) {
    console.error(`[relay-baton] session "${name}" has no worktree.`);
    process.exit(2);
  }
  const res = new GitService(repoRoot).removeWorktree(entry.worktree, opts.force);
  if (!res.ok) {
    console.error(`[relay-baton] git worktree remove failed: ${res.error}`);
    console.error("  (commit/stash changes in the worktree, or pass --force)");
    process.exit(1);
  }
  wm.setWorktree(name, undefined);
  console.log(`[relay-baton] removed worktree for "${name}".`);
}

/** `session remove <name>` — drop a named work item (never default). */
export async function sessionRemoveCommand(name: string, opts: SessionWorkOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  ConfigLoader.load(repoRoot);
  const wm = new WorkspaceManager(repoRoot);
  try {
    wm.remove(name, { deleteFiles: opts.deleteFiles });
  } catch (e: any) {
    console.error(`[relay-baton] ${e?.message ?? e}`);
    process.exit(2);
  }
  console.log(`[relay-baton] removed session "${name}"${opts.deleteFiles ? " (files deleted)" : ""}. active → ${wm.activeName()}`);
}
