import * as fs from "fs";
import * as path from "path";
import { IGNORE_DIRS } from "@relay-baton/shared";
import { WorkspaceMap, type WorkspaceMapResult } from "./WorkspaceMap";

export interface PackageInventory {
  name: string;
  path: string;
  scripts: string[];
}

export interface DependencyInventoryResult {
  repoRoot: string;
  rootScripts: string[];
  packages: PackageInventory[];
  ciWorkflows: string[];
  releaseFiles: string[];
  dependencyManifests: string[];
}

const MAX_LIST = 60;
const MANIFESTS = ["package.json", "Cargo.toml", "go.mod", "pyproject.toml", "requirements.txt", "Gemfile", "pnpm-workspace.yaml"];
const RELEASE_FILES = ["RELEASE.md", "CHANGELOG.md"];

/**
 * Deterministic, bounded inventory of package scripts, workspace packages, CI
 * workflows, and release files. Reads known manifest/config locations only —
 * no full-repo scanning, no model calls.
 */
export class DependencyInventory {
  constructor(private readonly repoRoot: string) {}

  generate(map?: WorkspaceMapResult): DependencyInventoryResult {
    const ws = map ?? new WorkspaceMap(this.repoRoot).generate();
    const rootPkg = this.readJson<any>("package.json");

    return {
      repoRoot: this.repoRoot,
      rootScripts: rootPkg?.scripts ? Object.keys(rootPkg.scripts).slice(0, MAX_LIST) : [],
      packages: ws.packages.map(p => ({
        name: p.name,
        path: p.path,
        scripts: Object.keys(this.readJson<any>(path.join(p.path, "package.json"))?.scripts ?? {}).slice(0, MAX_LIST),
      })),
      ciWorkflows: this.listDir(".github/workflows", /\.ya?ml$/),
      releaseFiles: this.releaseFiles(),
      dependencyManifests: MANIFESTS.filter(m => this.exists(m)),
    };
  }

  private releaseFiles(): string[] {
    const out = RELEASE_FILES.filter(f => this.exists(f));
    if (this.exists("docs/RELEASE.md")) out.push("docs/RELEASE.md");
    out.push(...this.listDir("install", /\.(sh|ps1)$/).map(f => `install/${f}`));
    if (this.exists("release-notes") && this.isDir("release-notes")) out.push("release-notes/");
    return out;
  }

  private listDir(rel: string, re: RegExp): string[] {
    const abs = path.join(this.repoRoot, rel);
    try {
      if (!fs.statSync(abs).isDirectory()) return [];
      return fs.readdirSync(abs, { withFileTypes: true })
        .filter(e => e.isFile() && re.test(e.name) && !IGNORE_DIRS.has(e.name))
        .map(e => e.name)
        .sort()
        .slice(0, MAX_LIST);
    } catch { return []; }
  }

  private abs(rel: string): string { return path.join(this.repoRoot, rel); }
  private exists(rel: string): boolean { try { return fs.existsSync(this.abs(rel)); } catch { return false; } }
  private isDir(rel: string): boolean { try { return fs.statSync(this.abs(rel)).isDirectory(); } catch { return false; } }
  private readJson<T>(rel: string): T | null {
    try { return JSON.parse(fs.readFileSync(this.abs(rel), "utf8")) as T; } catch { return null; }
  }
}
