import * as path from "path";
import { SESSION_DIR, SESSION_FILES } from "@relay-baton/shared";

export class SessionFiles {
  readonly dir: string;
  constructor(repoRoot: string) {
    this.dir = path.join(repoRoot, SESSION_DIR);
  }
  p(name: keyof typeof SESSION_FILES): string {
    return path.join(this.dir, SESSION_FILES[name]);
  }
}
