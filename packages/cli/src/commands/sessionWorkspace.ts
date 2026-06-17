import { ConfigLoader, SessionManager, WorkspaceManager } from "@relay-baton/core";
import { isAgentId } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface SessionWorkOpts extends ProjectOpts {
  json?: boolean;
  switch?: boolean;
  agent?: string;
  init?: boolean;
  deleteFiles?: boolean;
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
