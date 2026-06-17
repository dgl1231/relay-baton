import * as path from "path";
import { SESSION_FILES } from "@relay-baton/shared";
import { WorkspaceManager } from "./WorkspaceManager";

/**
 * Resolves artifact paths for a work item. v2.6: when no session name is given,
 * it points at the ACTIVE work item from `.ai-session/workspace.json` — which is
 * the legacy flat `.ai-session/` for the `default` session, so existing callers
 * (and repos) behave exactly as before until a named session is activated.
 */
export class SessionFiles {
  readonly dir: string;
  constructor(repoRoot: string, sessionName?: string) {
    this.dir = WorkspaceManager.resolveSessionDir(repoRoot, sessionName);
  }
  p(name: keyof typeof SESSION_FILES): string {
    return path.join(this.dir, SESSION_FILES[name]);
  }
}
