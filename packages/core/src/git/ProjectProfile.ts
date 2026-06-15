import * as fs from "fs";
import * as path from "path";
import type { BatonProject, RelayBatonConfig } from "@relay-baton/shared";
import { IGNORE_DIRS } from "@relay-baton/shared";
import { WorkspaceMap, type WorkspaceMapResult } from "./WorkspaceMap";

export interface ProjectProfileRecommended {
  build: string | null;
  test: string | null;
  diet: string;
  primaryAgent: string;
  fallbackAgent: string;
}

export interface ProjectProfileResult {
  repoRoot: string;
  tags: string[];
  frameworks: string[];
  recommended: ProjectProfileRecommended;
  excludePaths: string[];
  entryPoints: string[];
  monorepo: boolean;
  packageCount: number;
}

const FRAMEWORK_DEPS: Record<string, string> = {
  react: "react",
  vue: "vue",
  svelte: "svelte",
  next: "next",
  nuxt: "nuxt",
  angular: "@angular/core",
  express: "express",
  fastify: "fastify",
  nestjs: "@nestjs/core",
  vite: "vite",
  vitest: "vitest",
  jest: "jest",
  tauri: "@tauri-apps/api",
  electron: "electron",
  commander: "commander",
  ink: "ink",
};

/**
 * Deterministic project profile hints. Combines the workspace map with config
 * and the registered project's defaults to suggest command defaults, framework
 * tags, excluded paths, and preferred verification. Read-only, no model calls.
 */
export class ProjectProfile {
  constructor(
    private readonly repoRoot: string,
    private readonly config?: RelayBatonConfig,
    private readonly project?: BatonProject,
  ) {}

  generate(map?: WorkspaceMapResult): ProjectProfileResult {
    const ws = map ?? new WorkspaceMap(this.repoRoot).generate();
    const frameworks = this.detectFrameworks();
    const tags = [...ws.languages, ...frameworks];

    return {
      repoRoot: this.repoRoot,
      tags,
      frameworks,
      recommended: {
        build: this.recommendCommand("build", ws),
        test: this.recommendCommand("test", ws),
        diet: this.project?.defaultDiet ?? this.config?.tokenDiet.profile ?? "balanced",
        primaryAgent: this.project?.primaryAgent ?? this.config?.primaryAgent ?? "codex",
        fallbackAgent: this.project?.fallbackAgent ?? this.config?.fallbackAgent ?? "claude",
      },
      excludePaths: [...IGNORE_DIRS].sort(),
      entryPoints: ws.entryPoints,
      monorepo: ws.monorepo,
      packageCount: ws.packages.length,
    };
  }

  private recommendCommand(kind: "build" | "test", ws: WorkspaceMapResult): string | null {
    // An explicit config command wins.
    const configured = this.config?.commands?.[kind];
    if (configured && configured.trim()) return configured.trim();

    // Otherwise derive from detected scripts + package manager.
    const script = ws.scripts[kind];
    const jsPm = ws.packageManagers.find(p => p === "pnpm" || p === "npm" || p === "yarn");
    if (script && jsPm) return `${jsPm} run ${kind}`;
    if (ws.packageManagers.includes("cargo")) return `cargo ${kind === "test" ? "test" : "build"}`;
    if (ws.packageManagers.includes("go")) return `go ${kind === "test" ? "test ./..." : "build ./..."}`;
    return null;
  }

  private detectFrameworks(): string[] {
    const pkg = this.readJson<any>("package.json");
    const out: string[] = [];
    if (pkg) {
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      for (const [name, dep] of Object.entries(FRAMEWORK_DEPS)) {
        if (deps[dep]) out.push(name);
      }
    }
    // Tauri desktop shell often lives outside the JS workspace.
    if (!out.includes("tauri") && fs.existsSync(path.join(this.repoRoot, "desktop", "src-tauri"))) out.push("tauri");
    return [...new Set(out)];
  }

  private readJson<T>(rel: string): T | null {
    try { return JSON.parse(fs.readFileSync(path.join(this.repoRoot, rel), "utf8")) as T; } catch { return null; }
  }
}
