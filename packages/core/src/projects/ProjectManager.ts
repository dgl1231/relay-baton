import * as fs from "fs";
import * as path from "path";
import type { AgentId, BatonProject, DietProfileName, ProjectRegistryData } from "@relay-baton/shared";
import { cloneRegistryData, normalizeProjectPath, ProjectRegistry } from "./ProjectRegistry";

export interface AddProjectInput {
  path: string;
  name?: string;
  defaultDiet?: DietProfileName;
  primaryAgent?: AgentId;
  fallbackAgent?: AgentId;
}

export interface AddProjectResult {
  project: BatonProject;
  added: boolean;
  existing?: BatonProject;
}

export class ProjectManager {
  constructor(public registry = new ProjectRegistry()) {}

  listProjects(): BatonProject[] {
    return this.registry.ensure().projects;
  }

  getRegistry(): ProjectRegistryData {
    return cloneRegistryData(this.registry.ensure());
  }

  addProject(input: AddProjectInput): AddProjectResult {
    const data = this.registry.ensure();
    const resolvedPath = path.resolve(input.path);
    const existingByPath = data.projects.find(p => normalizeProjectPath(p.path) === normalizeProjectPath(resolvedPath));
    if (existingByPath) return { project: existingByPath, added: false, existing: existingByPath };

    const now = new Date().toISOString();
    const name = input.name?.trim() || path.basename(resolvedPath);
    const id = this.nextId(data.projects, slugify(name));
    const project: BatonProject = {
      id,
      name,
      path: resolvedPath,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
      defaultDiet: input.defaultDiet,
      primaryAgent: input.primaryAgent,
      fallbackAgent: input.fallbackAgent,
    };
    data.projects.push(project);
    if (!data.activeProjectId) data.activeProjectId = project.id;
    this.registry.write(data);
    return { project, added: true };
  }

  removeProject(nameOrId: string): BatonProject | null {
    const data = this.registry.ensure();
    const project = this.findProjectIn(data, nameOrId);
    if (!project) return null;
    data.projects = data.projects.filter(p => p.id !== project.id);
    if (data.activeProjectId === project.id) data.activeProjectId = null;
    this.registry.write(data);
    return project;
  }

  switchProject(nameOrId: string): BatonProject | null {
    const data = this.registry.ensure();
    const project = this.findProjectIn(data, nameOrId);
    if (!project) return null;
    const now = new Date().toISOString();
    project.lastUsedAt = now;
    project.updatedAt = now;
    data.activeProjectId = project.id;
    this.registry.write(data);
    return project;
  }

  getActiveProject(): BatonProject | null {
    const data = this.registry.ensure();
    if (!data.activeProjectId) return null;
    return data.projects.find(p => p.id === data.activeProjectId) ?? null;
  }

  resolveProjectPath(nameOrId: string): string | null {
    return this.findProject(nameOrId)?.path ?? null;
  }

  updateLastUsedAt(nameOrId: string): BatonProject | null {
    const data = this.registry.ensure();
    const project = this.findProjectIn(data, nameOrId);
    if (!project) return null;
    const now = new Date().toISOString();
    project.lastUsedAt = now;
    project.updatedAt = now;
    this.registry.write(data);
    return project;
  }

  findProject(nameOrId: string): BatonProject | null {
    return this.findProjectIn(this.registry.ensure(), nameOrId);
  }

  isGitRepo(projectPath: string): boolean {
    return fs.existsSync(path.join(projectPath, ".git"));
  }

  private findProjectIn(data: ProjectRegistryData, nameOrId: string): BatonProject | null {
    const key = nameOrId.toLowerCase();
    return data.projects.find(p => p.id.toLowerCase() === key || p.name.toLowerCase() === key) ?? null;
  }

  private nextId(projects: BatonProject[], baseId: string): string {
    let id = baseId || "project";
    let n = 2;
    const used = new Set(projects.map(p => p.id.toLowerCase()));
    while (used.has(id.toLowerCase())) {
      id = `${baseId}-${n}`;
      n += 1;
    }
    return id;
  }
}

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}
