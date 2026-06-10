import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { projectListCommand, projectCurrentCommand, projectAddCommand, projectRemoveCommand } from "../commands/project";

// Point the registry at a throwaway file so these tests never touch
// ~/.relay-baton/projects.json.
describe("project list/current --json", () => {
  let registryFile: string;
  let logs: string[];
  let savedEnv: string | undefined;

  beforeEach(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-projjson-"));
    registryFile = path.join(dir, "projects.json");
    savedEnv = process.env.RELAY_BATON_PROJECTS_FILE;
    process.env.RELAY_BATON_PROJECTS_FILE = registryFile;
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.map(a => String(a)).join(" "));
    });
  });

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.RELAY_BATON_PROJECTS_FILE;
    else process.env.RELAY_BATON_PROJECTS_FILE = savedEnv;
    vi.restoreAllMocks();
  });

  it("list --json emits an empty registry as valid JSON", async () => {
    await projectListCommand({ json: true });
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.activeProjectId).toBeNull();
    expect(parsed.projects).toEqual([]);
  });

  it("list --json emits registered projects and the active id", async () => {
    fs.writeFileSync(registryFile, JSON.stringify({
      activeProjectId: "p1",
      projects: [
        { id: "p1", name: "alpha", path: "/tmp/alpha", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
        { id: "p2", name: "beta", path: "/tmp/beta", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
      ],
    }), "utf8");

    await projectListCommand({ json: true });
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.activeProjectId).toBe("p1");
    expect(parsed.projects.map((p: any) => p.name)).toEqual(["alpha", "beta"]);
  });

  it("current --json reports active=null plus cwd when nothing is active", async () => {
    await projectCurrentCommand({ json: true });
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.active).toBeNull();
    expect(typeof parsed.cwd).toBe("string");
  });

  it("current --json reports the active project", async () => {
    fs.writeFileSync(registryFile, JSON.stringify({
      activeProjectId: "p2",
      projects: [
        { id: "p1", name: "alpha", path: "/tmp/alpha", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
        { id: "p2", name: "beta", path: "/tmp/beta", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
      ],
    }), "utf8");

    await projectCurrentCommand({ json: true });
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.active?.name).toBe("beta");
  });

  it("plain list output is unchanged (human format, no JSON)", async () => {
    await projectListCommand({});
    expect(logs.join("\n")).toMatch(/no registered projects/);
  });

  it("add --json emits the added project", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-projjson-repo-"));
    spawnSync("git", ["init"], { cwd: repo });

    await projectAddCommand(repo, { json: true });
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.added).toBe(true);
    expect(parsed.project.name).toBe(path.basename(repo));
    expect(parsed.project.path).toBe(path.resolve(repo));
  });

  it("add --json accepts a non-git project directory", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-projjson-folder-"));

    await projectAddCommand(dir, { json: true });
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.added).toBe(true);
    expect(parsed.project.path).toBe(path.resolve(dir));
  });

  it("remove --json emits the removed project", async () => {
    fs.writeFileSync(registryFile, JSON.stringify({
      activeProjectId: "p1",
      projects: [
        { id: "p1", name: "alpha", path: "/tmp/alpha", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
      ],
    }), "utf8");

    await projectRemoveCommand("alpha", { json: true });
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.removed.name).toBe("alpha");
  });
});
