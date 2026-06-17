import * as fs from "fs";
import * as path from "path";
import {
  SESSION_DIR, WORKSPACE_FILE, SESSIONS_SUBDIR, DEFAULT_SESSION,
} from "@relay-baton/shared";
import type { AgentId } from "@relay-baton/shared";

/**
 * v2.6 — multi-session workspace. Owns `.ai-session/workspace.json`, which tracks
 * the named work items in a repo and which one is active. The legacy flat
 * `.ai-session/` is the `default` work item, so existing repos keep working with
 * zero migration. Named items live under `.ai-session/sessions/<name>/`.
 *
 * Deterministic and local: just JSON on disk, no daemon, no network.
 */

export interface WorkspaceSession {
  name: string;
  createdAt: string;
  /** v2.6 item 2 hook: pin this work item to an agent / relay chain. */
  assignedAgent?: AgentId;
  /**
   * v2.6 item 3: absolute path to a git worktree backing this item. When set,
   * `run`/`handoff` execute in that isolated checkout (own working tree + own
   * `.ai-session`), so parallel work items never clobber each other's git state.
   */
  worktree?: string;
}

export interface Workspace {
  version: 1;
  active: string;
  sessions: WorkspaceSession[];
}

const NAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,62})$/;

export function isValidSessionName(name: string): boolean {
  if (!NAME_RE.test(name)) return false;
  // reserve structural names that would collide with the on-disk layout
  return name !== SESSIONS_SUBDIR && name !== WORKSPACE_FILE.replace(/\.json$/, "");
}

export class WorkspaceManager {
  private readonly aiDir: string;
  private readonly file: string;
  constructor(private readonly repoRoot: string) {
    this.aiDir = path.join(repoRoot, SESSION_DIR);
    this.file = path.join(this.aiDir, WORKSPACE_FILE);
  }

  /** Cheap static read of the active work-item name ("default" when unset). */
  static activeName(repoRoot: string): string {
    try {
      const raw = fs.readFileSync(path.join(repoRoot, SESSION_DIR, WORKSPACE_FILE), "utf8");
      const ws = JSON.parse(raw) as Workspace;
      return typeof ws?.active === "string" && ws.active ? ws.active : DEFAULT_SESSION;
    } catch {
      return DEFAULT_SESSION;
    }
  }

  /** Resolve a work item's artifact directory. `default` = the legacy flat dir. */
  static resolveSessionDir(repoRoot: string, name?: string): string {
    const n = name ?? WorkspaceManager.activeName(repoRoot);
    const base = path.join(repoRoot, SESSION_DIR);
    return n === DEFAULT_SESSION ? base : path.join(base, SESSIONS_SUBDIR, n);
  }

  load(): Workspace {
    try {
      const ws = JSON.parse(fs.readFileSync(this.file, "utf8")) as Workspace;
      if (ws && Array.isArray(ws.sessions) && typeof ws.active === "string") {
        return this.withDefault(ws);
      }
    } catch { /* fall through to synthesized default */ }
    return { version: 1, active: DEFAULT_SESSION, sessions: [this.defaultEntry()] };
  }

  /** All work items, default first. Always includes `default`. */
  list(): WorkspaceSession[] {
    return this.load().sessions;
  }

  activeName(): string {
    return this.load().active;
  }

  has(name: string): boolean {
    return name === DEFAULT_SESSION || this.load().sessions.some(s => s.name === name);
  }

  /** Create a new named work item (does not switch unless `activate`). */
  create(name: string, opts: { assignedAgent?: AgentId; activate?: boolean } = {}): Workspace {
    if (!isValidSessionName(name)) {
      throw new Error(`invalid session name: "${name}" (use letters/digits/._- , not "default"-reserved structural names)`);
    }
    if (name === DEFAULT_SESSION) throw new Error(`"${DEFAULT_SESSION}" already exists (the legacy flat session)`);
    const ws = this.load();
    if (ws.sessions.some(s => s.name === name)) throw new Error(`session already exists: ${name}`);
    ws.sessions.push({ name, createdAt: new Date().toISOString(), assignedAgent: opts.assignedAgent });
    if (opts.activate) ws.active = name;
    fs.mkdirSync(WorkspaceManager.resolveSessionDir(this.repoRoot, name), { recursive: true });
    this.save(ws);
    return ws;
  }

  /** Switch the active work item. Must be `default` or an existing item. */
  switchTo(name: string): Workspace {
    const ws = this.load();
    if (name !== DEFAULT_SESSION && !ws.sessions.some(s => s.name === name)) {
      throw new Error(`unknown session: ${name}`);
    }
    ws.active = name;
    this.save(ws);
    return ws;
  }

  /** Set the assigned agent for a work item (v2.6 item 2 groundwork). */
  assignAgent(name: string, agent: AgentId | undefined): Workspace {
    const ws = this.load();
    const entry = ws.sessions.find(s => s.name === name);
    if (!entry) throw new Error(`unknown session: ${name}`);
    entry.assignedAgent = agent;
    this.save(ws);
    return ws;
  }

  /** Record (or clear) the git worktree backing a work item (v2.6 item 3). */
  setWorktree(name: string, worktree: string | undefined): Workspace {
    const ws = this.load();
    const entry = ws.sessions.find(s => s.name === name);
    if (!entry) throw new Error(`unknown session: ${name}`);
    entry.worktree = worktree;
    this.save(ws);
    return ws;
  }

  /** The active work item's record (or undefined for synthesized default). */
  activeSession(): WorkspaceSession | undefined {
    const ws = this.load();
    return ws.sessions.find(s => s.name === ws.active);
  }

  /** Remove a named work item (never `default`). Optionally delete its files. */
  remove(name: string, opts: { deleteFiles?: boolean } = {}): Workspace {
    if (name === DEFAULT_SESSION) throw new Error(`cannot remove the ${DEFAULT_SESSION} session`);
    const ws = this.load();
    if (!ws.sessions.some(s => s.name === name)) throw new Error(`unknown session: ${name}`);
    ws.sessions = ws.sessions.filter(s => s.name !== name);
    if (ws.active === name) ws.active = DEFAULT_SESSION;
    if (opts.deleteFiles) {
      try { fs.rmSync(WorkspaceManager.resolveSessionDir(this.repoRoot, name), { recursive: true, force: true }); } catch { /* best effort */ }
    }
    this.save(ws);
    return ws;
  }

  private defaultEntry(): WorkspaceSession {
    return { name: DEFAULT_SESSION, createdAt: new Date().toISOString() };
  }

  private withDefault(ws: Workspace): Workspace {
    if (!ws.sessions.some(s => s.name === DEFAULT_SESSION)) {
      ws.sessions = [this.defaultEntry(), ...ws.sessions];
    } else {
      // ensure default is listed first for stable display
      ws.sessions = [
        ...ws.sessions.filter(s => s.name === DEFAULT_SESSION),
        ...ws.sessions.filter(s => s.name !== DEFAULT_SESSION),
      ];
    }
    return ws;
  }

  private save(ws: Workspace): void {
    fs.mkdirSync(this.aiDir, { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.withDefault(ws), null, 2) + "\n", "utf8");
  }
}
