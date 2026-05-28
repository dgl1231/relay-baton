import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import {
  projectAddCommand,
  projectListCommand,
  projectSwitchCommand,
  projectCurrentCommand,
  projectRemoveCommand,
  projectDoctorCommand,
} from "../commands/project";

function mkGitRepo(label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `rb-smoke-${label}-`));
  // -q to silence, and pin initial branch to avoid env-dependent default.
  execSync("git init -q -b main", { cwd: dir, stdio: "ignore" });
  return dir;
}

describe("project lifecycle smoke", () => {
  let logs: string[];
  let errs: string[];
  let registryFile: string;
  let repoA: string;
  let repoB: string;
  let savedEnv: string | undefined;

  beforeEach(() => {
    logs = [];
    errs = [];

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-registry-"));
    registryFile = path.join(tmpDir, "projects.json");
    savedEnv = process.env.RELAY_BATON_PROJECTS_FILE;
    process.env.RELAY_BATON_PROJECTS_FILE = registryFile;

    repoA = mkGitRepo("a");
    repoB = mkGitRepo("b");

    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.map((a) => String(a)).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: any[]) => {
      errs.push(args.map((a) => String(a)).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (savedEnv === undefined) delete process.env.RELAY_BATON_PROJECTS_FILE;
    else process.env.RELAY_BATON_PROJECTS_FILE = savedEnv;
  });

  function readRegistry(): {
    activeProjectId: string | null;
    projects: Array<{
      id: string;
      name: string;
      path: string;
      defaultDiet?: string;
      primaryAgent?: string;
      fallbackAgent?: string;
      [k: string]: any;
    }>;
  } {
    return JSON.parse(fs.readFileSync(registryFile, "utf8"));
  }

  it("walks add → list → switch → current → remove → doctor against two tmp repos", async () => {
    // ── add A (alpha) ─────────────────────────────────────────
    await projectAddCommand(repoA, {
      name: "alpha",
      diet: "caveman",
      primary: "codex",
      fallback: "claude",
    });
    expect(logs.join("\n")).toMatch(/project added/);
    expect(logs.join("\n")).toMatch(/alpha/);

    {
      const data = readRegistry();
      expect(data.projects).toHaveLength(1);
      expect(data.projects[0].name).toBe("alpha");
      expect(data.projects[0].defaultDiet).toBe("caveman");
      expect(data.projects[0].primaryAgent).toBe("codex");
      expect(data.projects[0].fallbackAgent).toBe("claude");
      expect(data.activeProjectId).toBe(data.projects[0].id);
    }

    // ── add A again — idempotent ──────────────────────────────
    logs.length = 0;
    await projectAddCommand(repoA, { name: "alpha-clone" });
    expect(logs.join("\n")).toMatch(/already registered/);
    expect(readRegistry().projects).toHaveLength(1);

    // ── add B (bravo) ─────────────────────────────────────────
    logs.length = 0;
    await projectAddCommand(repoB, { name: "bravo" });
    expect(logs.join("\n")).toMatch(/project added/);
    expect(logs.join("\n")).toMatch(/bravo/);
    expect(readRegistry().projects).toHaveLength(2);

    // ── list — both shown, alpha marked active (*) ────────────
    logs.length = 0;
    await projectListCommand();
    const listOut = logs.join("\n");
    expect(listOut).toMatch(/alpha/);
    expect(listOut).toMatch(/bravo/);
    expect(listOut).toMatch(/\*\s+alpha/);
    expect(listOut).not.toMatch(/\*\s+bravo/);

    // ── switch active → bravo ─────────────────────────────────
    logs.length = 0;
    await projectSwitchCommand("bravo");
    expect(logs.join("\n")).toMatch(/active project: bravo/);
    {
      const data = readRegistry();
      const bravo = data.projects.find((p) => p.name === "bravo")!;
      expect(data.activeProjectId).toBe(bravo.id);
    }

    // ── current — reports bravo as active ─────────────────────
    logs.length = 0;
    await projectCurrentCommand();
    expect(logs.join("\n")).toMatch(/\*\s+bravo/);

    // ── doctor — surfaces both, git_repo: yes for tmp repos ───
    logs.length = 0;
    await projectDoctorCommand();
    const doctorOut = logs.join("\n");
    expect(doctorOut).toMatch(/alpha/);
    expect(doctorOut).toMatch(/bravo/);
    expect(doctorOut).toMatch(/git repo: yes/);
    // doctor marks the active row with leading "*"
    expect(doctorOut.split("\n").some((l) => /^\*\s+bravo/.test(l))).toBe(true);

    // ── remove alpha ──────────────────────────────────────────
    logs.length = 0;
    await projectRemoveCommand("alpha");
    expect(logs.join("\n")).toMatch(/project removed: alpha/);
    {
      const data = readRegistry();
      expect(data.projects).toHaveLength(1);
      expect(data.projects[0].name).toBe("bravo");
      // removing a non-active project must not touch activeProjectId
      expect(data.activeProjectId).toBe(data.projects[0].id);
    }

    // ── current still reports bravo ───────────────────────────
    logs.length = 0;
    await projectCurrentCommand();
    expect(logs.join("\n")).toMatch(/bravo/);

    // No errors expected on the happy path.
    expect(errs).toEqual([]);
  });

  it("removing the active project clears activeProjectId", async () => {
    await projectAddCommand(repoA, { name: "solo" });
    {
      const data = readRegistry();
      expect(data.activeProjectId).toBe(data.projects[0].id);
    }

    logs.length = 0;
    await projectRemoveCommand("solo");

    const data = readRegistry();
    expect(data.projects).toHaveLength(0);
    expect(data.activeProjectId).toBeNull();
  });
});
