import * as path from "path";
import type { BatonProject } from "@relay-baton/shared";
import { ProjectManager } from "./ProjectManager";

export interface ProjectResolveInput {
  path?: string;
  project?: string;
  cwd?: string;
}

export interface ProjectResolveResult {
  repoRoot: string;
  source: "path" | "project" | "active" | "cwd";
  project?: BatonProject;
}

export class ProjectResolver {
  constructor(public manager = new ProjectManager()) {}

  resolve(input: ProjectResolveInput = {}): ProjectResolveResult {
    const cwd = input.cwd ?? process.cwd();
    if (input.path) {
      return { repoRoot: path.resolve(input.path), source: "path" };
    }
    if (input.project) {
      const project = this.manager.findProject(input.project);
      if (!project) throw new Error(`project not found: ${input.project}`);
      return { repoRoot: project.path, source: "project", project };
    }
    const active = this.manager.getActiveProject();
    if (active) {
      return { repoRoot: active.path, source: "active", project: active };
    }
    return { repoRoot: cwd, source: "cwd" };
  }

  touch(result: ProjectResolveResult): void {
    if (result.project) this.manager.updateLastUsedAt(result.project.id);
  }
}
