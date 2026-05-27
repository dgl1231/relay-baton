import * as fs from "fs";
import * as path from "path";

export interface RelevantFile {
  path: string;
  reason: string;
}

export class ContextSelector {
  constructor(private repoRoot: string) {}

  select(changedFiles: string[], task: string): RelevantFile[] {
    const out: RelevantFile[] = [];
    const seen = new Set<string>();
    const add = (p: string, reason: string) => {
      if (!p || seen.has(p)) return;
      seen.add(p);
      out.push({ path: p, reason });
    };
    for (const f of changedFiles) add(f, "changed");
    for (const f of this.taskMentioned(task)) add(f, "task mentions");
    for (const f of this.configFiles()) add(f, "key project file");
    if (this.exists("AGENTS.md")) add("AGENTS.md", "shared agent instructions");
    if (this.exists("CLAUDE.md")) add("CLAUDE.md", "Claude-specific instructions");
    return out;
  }

  private exists(rel: string): boolean {
    return fs.existsSync(path.join(this.repoRoot, rel));
  }

  private taskMentioned(task: string): string[] {
    const matches = new Set<string>();
    const re = /[\w./\\-]+\.[A-Za-z0-9]{1,8}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(task)) !== null) {
      if (this.exists(m[0])) matches.add(m[0].replace(/\\/g, "/"));
    }
    return [...matches];
  }

  private configFiles(): string[] {
    const candidates = [
      "package.json", "pnpm-workspace.yaml", "tsconfig.json", "tsconfig.base.json",
      "vite.config.ts", "vite.config.js", "Dockerfile", "docker-compose.yml",
      "relay-baton.config.json",
    ];
    return candidates.filter(c => this.exists(c));
  }
}
