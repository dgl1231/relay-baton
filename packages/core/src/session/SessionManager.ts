import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { SessionMeta, RelayBatonConfig } from "@relay-baton/shared";
import { SESSION_FILES, SESSION_SCHEMA_VERSION } from "@relay-baton/shared";
import { SessionFiles } from "./SessionFiles";
import { readSessionMeta, writeSessionMeta } from "./SessionState";

export interface InitResult {
  created: boolean;
  alreadyExisted: boolean;
  dir: string;
  createdFiles: string[];
}

export class SessionManager {
  readonly files: SessionFiles;
  constructor(public repoRoot: string, public config: RelayBatonConfig) {
    this.files = new SessionFiles(repoRoot);
  }

  init(task = ""): InitResult {
    const dir = this.files.dir;
    const existed = fs.existsSync(dir);
    if (!existed) fs.mkdirSync(dir, { recursive: true });

    const ensure = (name: keyof typeof SESSION_FILES, content: string): string | null => {
      const p = this.files.p(name);
      if (fs.existsSync(p)) return null;
      fs.writeFileSync(p, content, "utf8");
      return p;
    };

    const createdFiles: string[] = [];
    const add = (n: keyof typeof SESSION_FILES, c: string) => {
      const f = ensure(n, c);
      if (f) createdFiles.push(f);
    };

    add("task", task ? task + "\n" : "# Task\n\n(describe the user task here)\n");
    add("state", "# Current State\n\n## Goal\n\n## Done\n\n## In Progress\n\n## Remaining\n\n## Decisions\n\n## Risks\n\n## Next Step\n");
    add("compactState", "# Compact State\n\n## Goal\n\n## Done\n\n## In Progress\n\n## Remaining\n\n## Decisions\n\n## Risks\n\n## Next Step\n");
    add("decisions", "# Decisions\n");
    add("changedFiles", "# Changed Files\n");
    add("repoMap", "# Repo Map\n");
    add("commandsLog", "");
    add("errors", "# Errors\n");
    add("testResults", "# Test Results\n");
    add("fullDiff", "");
    add("contextBudget", "{}\n");

    const metaPath = this.files.p("sessionJson");
    if (!fs.existsSync(metaPath)) {
      const meta: SessionMeta = {
        schemaVersion: SESSION_SCHEMA_VERSION,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        repoRoot: this.repoRoot,
        task,
        status: "initialized",
        primaryAgent: this.config.primaryAgent,
        fallbackAgent: this.config.fallbackAgent,
        activeAgent: "none",
        lastAgent: "none",
        fallbackReason: null,
        lastError: null,
        tokenDietProfile: this.config.tokenDiet.profile,
      };
      writeSessionMeta(metaPath, meta);
      createdFiles.push(metaPath);
    }

    return { created: createdFiles.length > 0, alreadyExisted: existed, dir, createdFiles };
  }

  getMeta(): SessionMeta | null {
    return readSessionMeta(this.files.p("sessionJson"));
  }

  updateMeta(patch: Partial<SessionMeta>): SessionMeta | null {
    const cur = this.getMeta();
    if (!cur) return null;
    const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
    writeSessionMeta(this.files.p("sessionJson"), next);
    return next;
  }

  writeTask(task: string) {
    fs.writeFileSync(this.files.p("task"), task + "\n", "utf8");
  }

  appendLog(line: string) {
    fs.appendFileSync(this.files.p("commandsLog"), line + (line.endsWith("\n") ? "" : "\n"), "utf8");
  }

  backupHandoffIfExists(): string | null {
    const p = this.files.p("handoff");
    if (!fs.existsSync(p)) return null;
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = path.join(this.files.dir, `handoff.${ts}.md`);
    fs.copyFileSync(p, backup);
    return backup;
  }
}
