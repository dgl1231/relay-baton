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
      this.manager.updateLastUsedAt(project.id);
      return { repoRoot: project.path, source: "project", project };
    }
    const active = this.manager.getActiveProject();
    if (active) {
      this.manager.updateLastUsedAt(active.id);
      return { repoRoot: active.path, source: "active", project: active };
    }
    return { repoRoot: cwd, source: "cwd" };
  }
}
