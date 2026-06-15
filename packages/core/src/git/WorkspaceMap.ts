import * as fs from "fs";
import * as path from "path";
import { IGNORE_DIRS } from "@relay-baton/shared";

export interface WorkspacePackage {
  name: string;
  path: string;
}

export interface WorkspaceScripts {
  build: string | null;
  test: string | null;
  lint: string | null;
  others: string[];
}

export interface WorkspaceMapResult {
  repoRoot: string;
  packageManagers: string[];
  languages: string[];
  monorepo: boolean;
  packages: WorkspacePackage[];
  scripts: WorkspaceScripts;
  entryPoints: string[];
  docs: string[];
  agentsFiles: string[];
}

const MAX_PACKAGES = 50;

/**
 * Deterministic, bounded workspace map. It detects package managers, languages,
 * monorepo packages, npm scripts, entry points, docs, and AGENTS/CLAUDE files
 * straight from manifest/config files — no file-content scanning beyond known
 * manifests, no semantic indexing, no model calls.
 */
export class WorkspaceMap {
  constructor(private readonly repoRoot: string) {}

  generate(): WorkspaceMapResult {
    const rootPkg = this.readJson<any>("package.json");
    const packageManagers = this.detectPackageManagers();
    const packages = this.detectPackages(rootPkg);

    return {
      repoRoot: this.repoRoot,
      packageManagers,
      languages: this.detectLanguages(packageManagers, packages),
      monorepo: packages.length > 0 || this.exists("pnpm-workspace.yaml"),
      packages,
      scripts: this.detectScripts(rootPkg),
      entryPoints: this.detectEntryPoints(rootPkg),
      docs: this.detectDocs(),
      agentsFiles: this.detectAgentsFiles(),
    };
  }

  private detectPackageManagers(): string[] {
    const out: string[] = [];
    if (this.exists("pnpm-lock.yaml") || this.exists("pnpm-workspace.yaml")) out.push("pnpm");
    if (this.exists("package-lock.json")) out.push("npm");
    if (this.exists("yarn.lock")) out.push("yarn");
    if (this.exists("Cargo.toml")) out.push("cargo");
    if (this.exists("go.mod")) out.push("go");
    if (this.exists("pyproject.toml") || this.exists("requirements.txt") || this.exists("Pipfile")) out.push("pip");
    if (this.exists("Gemfile")) out.push("bundler");
    if (this.hasShallow(/\.(sln|csproj)$/)) out.push("dotnet");
    return [...new Set(out)];
  }

  private detectLanguages(pms: string[], packages: WorkspacePackage[] = []): string[] {
    const out: string[] = [];
    const tsInPackage = packages.some(p => this.exists(path.join(p.path, "tsconfig.json")));
    if (this.exists("tsconfig.json") || this.hasShallow(/\.ts$/) || tsInPackage) out.push("typescript");
    if (this.exists("package.json")) out.push("javascript");
    if (pms.includes("cargo")) out.push("rust");
    if (pms.includes("go")) out.push("go");
    if (pms.includes("pip")) out.push("python");
    if (pms.includes("bundler")) out.push("ruby");
    if (pms.includes("dotnet")) out.push("csharp");
    return [...new Set(out)];
  }

  private detectPackages(rootPkg: any): WorkspacePackage[] {
    const globs = this.workspaceGlobs(rootPkg);
    const out: WorkspacePackage[] = [];
    for (const g of globs) {
      if (out.length >= MAX_PACKAGES) break;
      for (const dir of this.expandGlob(g)) {
        if (out.length >= MAX_PACKAGES) break;
        const pkg = this.readJson<any>(path.join(dir, "package.json"));
        if (pkg) out.push({ name: pkg.name ?? dir, path: dir.replace(/\\/g, "/") });
      }
    }
    return out;
  }

  private workspaceGlobs(rootPkg: any): string[] {
    // pnpm-workspace.yaml takes precedence; otherwise package.json "workspaces".
    const ws = this.readText("pnpm-workspace.yaml");
    if (ws) {
      const globs: string[] = [];
      for (const line of ws.split(/\r?\n/)) {
        const m = /^\s*-\s*["']?([^"'#]+?)["']?\s*$/.exec(line);
        if (m) globs.push(m[1].trim());
      }
      if (globs.length > 0) return globs;
    }
    if (Array.isArray(rootPkg?.workspaces)) return rootPkg.workspaces;
    if (Array.isArray(rootPkg?.workspaces?.packages)) return rootPkg.workspaces.packages;
    return [];
  }

  private expandGlob(glob: string): string[] {
    const clean = glob.replace(/^\.\//, "");
    if (clean.endsWith("/*")) {
      const base = clean.slice(0, -2);
      const baseAbs = path.join(this.repoRoot, base);
      let entries: fs.Dirent[] = [];
      try { entries = fs.readdirSync(baseAbs, { withFileTypes: true }); } catch { return []; }
      return entries
        .filter(e => e.isDirectory() && !IGNORE_DIRS.has(e.name))
        .map(e => path.join(base, e.name));
    }
    return this.exists(path.join(clean, "package.json")) ? [clean] : [];
  }

  private detectScripts(rootPkg: any): WorkspaceScripts {
    const scripts: Record<string, string> = rootPkg?.scripts ?? {};
    const names = Object.keys(scripts);
    return {
      build: scripts.build ?? null,
      test: scripts.test ?? null,
      lint: scripts.lint ?? null,
      others: names.filter(n => !["build", "test", "lint"].includes(n)).slice(0, 12),
    };
  }

  private detectEntryPoints(rootPkg: any): string[] {
    const out: string[] = [];
    if (typeof rootPkg?.main === "string") out.push(rootPkg.main);
    if (typeof rootPkg?.module === "string") out.push(rootPkg.module);
    if (typeof rootPkg?.bin === "string") out.push(rootPkg.bin);
    else if (rootPkg?.bin && typeof rootPkg.bin === "object") out.push(...Object.values(rootPkg.bin).filter((v): v is string => typeof v === "string"));
    for (const candidate of ["src/index.ts", "src/index.js", "src/main.ts", "index.ts", "index.js", "main.go", "src/main.rs"]) {
      if (this.exists(candidate)) out.push(candidate);
    }
    return [...new Set(out)];
  }

  private detectDocs(): string[] {
    const out: string[] = [];
    for (const f of ["README.md", "README", "CONTRIBUTING.md", "CHANGELOG.md"]) {
      if (this.exists(f)) out.push(f);
    }
    if (this.exists("docs") && this.isDir("docs")) out.push("docs/");
    return out;
  }

  private detectAgentsFiles(): string[] {
    const out: string[] = [];
    for (const f of ["AGENTS.md", "CLAUDE.md", ".claude/CLAUDE.md", ".cursorrules"]) {
      if (this.exists(f)) out.push(f);
    }
    return out;
  }

  // --- helpers ---
  private abs(rel: string): string { return path.join(this.repoRoot, rel); }
  private exists(rel: string): boolean { try { return fs.existsSync(this.abs(rel)); } catch { return false; } }
  private isDir(rel: string): boolean { try { return fs.statSync(this.abs(rel)).isDirectory(); } catch { return false; } }
  private readText(rel: string): string | null { try { return fs.readFileSync(this.abs(rel), "utf8"); } catch { return null; } }
  private readJson<T>(rel: string): T | null {
    const t = this.readText(rel);
    if (t == null) return null;
    try { return JSON.parse(t) as T; } catch { return null; }
  }
  private hasShallow(re: RegExp): boolean {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(this.repoRoot, { withFileTypes: true }); } catch { return false; }
    return entries.some(e => e.isFile() && re.test(e.name));
  }
}
