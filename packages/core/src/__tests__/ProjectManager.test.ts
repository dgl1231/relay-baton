import { describe, it, expect } from "vitest";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { ProjectManager } from "../projects/ProjectManager";
import { ProjectRegistry } from "../projects/ProjectRegistry";
import { ProjectResolver } from "../projects/ProjectResolver";

function tempRegistry() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-projects-"));
  return {
    dir,
    file: path.join(dir, ".relay-baton", "projects.json"),
  };
}

function tempRepo(name: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `rb-${name}-`));
  fs.mkdirSync(path.join(dir, ".git"));
  return dir;
}

describe("ProjectManager / ProjectRegistry", () => {
  it("creates projects.json when missing", () => {
    const { file } = tempRegistry();
    const registry = new ProjectRegistry(file);
    const data = registry.ensure();
    expect(data.projects).toEqual([]);
    expect(data.activeProjectId).toBeNull();
    expect(fs.existsSync(file)).toBe(true);
  });

  it("adds project and prevents duplicate path", () => {
    const { file } = tempRegistry();
    const repo = tempRepo("one");
    const manager = new ProjectManager(new ProjectRegistry(file));
    const added = manager.addProject({ path: repo, name: "relay-baton", defaultDiet: "caveman" });
    const duplicate = manager.addProject({ path: repo, name: "other" });
    expect(added.added).toBe(true);
    expect(added.project.id).toBe("relay-baton");
    expect(duplicate.added).toBe(false);
    expect(manager.listProjects()).toHaveLength(1);
  });

  it("switches active project", () => {
    const { file } = tempRegistry();
    const manager = new ProjectManager(new ProjectRegistry(file));
    manager.addProject({ path: tempRepo("one"), name: "one" });
    manager.addProject({ path: tempRepo("two"), name: "two" });
    const switched = manager.switchProject("two");
    expect(switched?.name).toBe("two");
    expect(manager.getActiveProject()?.name).toBe("two");
    expect(manager.getActiveProject()?.lastUsedAt).toBeTruthy();
  });

  it("removes project and clears activeProjectId when active is removed", () => {
    const { file } = tempRegistry();
    const manager = new ProjectManager(new ProjectRegistry(file));
    manager.addProject({ path: tempRepo("one"), name: "one" });
    manager.switchProject("one");
    const removed = manager.removeProject("one");
    expect(removed?.name).toBe("one");
    expect(manager.getRegistry().activeProjectId).toBeNull();
    expect(manager.listProjects()).toHaveLength(0);
  });

  it("resolves --path > --project > active > cwd", () => {
    const { file } = tempRegistry();
    const manager = new ProjectManager(new ProjectRegistry(file));
    const one = tempRepo("one");
    const two = tempRepo("two");
    const explicit = tempRepo("explicit");
    manager.addProject({ path: one, name: "one" });
    manager.addProject({ path: two, name: "two" });
    manager.switchProject("one");
    const resolver = new ProjectResolver(manager);

    expect(resolver.resolve({ cwd: "/tmp/cwd" }).repoRoot).toBe(one);
    expect(resolver.resolve({ project: "two", cwd: "/tmp/cwd" }).repoRoot).toBe(two);
    expect(resolver.resolve({ path: explicit, project: "two", cwd: "/tmp/cwd" }).repoRoot).toBe(explicit);

    manager.removeProject("one");
    manager.removeProject("two");
    expect(resolver.resolve({ cwd: "/tmp/cwd" }).repoRoot).toBe("/tmp/cwd");
  });
});
