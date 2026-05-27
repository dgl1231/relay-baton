import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { BatonProject, ProjectRegistryData } from "@relay-baton/shared";

export class ProjectRegistryError extends Error {}

export class ProjectRegistry {
  readonly filePath: string;

  constructor(filePath = ProjectRegistry.defaultPath()) {
    this.filePath = filePath;
  }

  static defaultPath(): string {
    return path.join(os.homedir(), ".relay-baton", "projects.json");
  }

  ensure(): ProjectRegistryData {
    if (!fs.existsSync(this.filePath)) {
      const empty: ProjectRegistryData = { activeProjectId: null, projects: [] };
      this.write(empty);
      return empty;
    }
    return this.read();
  }

  read(): ProjectRegistryData {
    if (!fs.existsSync(this.filePath)) return this.ensure();
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    } catch (e: any) {
      throw new ProjectRegistryError(`invalid project registry JSON at ${this.filePath}: ${e?.message ?? e}`);
    }
    if (!this.isRegistryData(parsed)) {
      throw new ProjectRegistryError(`invalid project registry shape at ${this.filePath}`);
    }
    return parsed;
  }

  write(data: ProjectRegistryData): void {
    this.validateUnique(data);
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
  }

  private isRegistryData(value: unknown): value is ProjectRegistryData {
    if (!value || typeof value !== "object") return false;
    const v = value as ProjectRegistryData;
    if (v.activeProjectId !== null && typeof v.activeProjectId !== "string") return false;
    if (!Array.isArray(v.projects)) return false;
    return v.projects.every(p =>
      p &&
      typeof p.id === "string" &&
      typeof p.name === "string" &&
      typeof p.path === "string" &&
      typeof p.createdAt === "string" &&
      typeof p.updatedAt === "string"
    );
  }

  private validateUnique(data: ProjectRegistryData): void {
    const ids = new Set<string>();
    const paths = new Set<string>();
    for (const project of data.projects) {
      const idKey = project.id.toLowerCase();
      const pathKey = normalizeProjectPath(project.path);
      if (ids.has(idKey)) throw new ProjectRegistryError(`duplicate project id: ${project.id}`);
      if (paths.has(pathKey)) throw new ProjectRegistryError(`duplicate project path: ${project.path}`);
      ids.add(idKey);
      paths.add(pathKey);
    }
  }
}

export function normalizeProjectPath(projectPath: string): string {
  return path.resolve(projectPath).replace(/[\\/]+$/, "").toLowerCase();
}

export function cloneRegistryData(data: ProjectRegistryData): ProjectRegistryData {
  return {
    activeProjectId: data.activeProjectId,
    projects: data.projects.map((p: BatonProject) => ({ ...p })),
  };
}
