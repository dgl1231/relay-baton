import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import { planCommand } from "../commands/plan";
import { executeCommand } from "../commands/execute";

function mkGitRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-planex-"));
  execSync("git init -q -b main", { cwd: dir, stdio: "ignore" });
  execSync('git config user.email "t@example.invalid"', { cwd: dir, stdio: "ignore" });
  execSync('git config user.name "t"', { cwd: dir, stdio: "ignore" });
  fs.writeFileSync(path.join(dir, "README.md"), "# fixture\n");
  execSync("git add .", { cwd: dir, stdio: "ignore" });
  execSync('git commit -q -m init', { cwd: dir, stdio: "ignore" });
  return dir;
}

function readMeta(repo: string): any {
  return JSON.parse(fs.readFileSync(path.join(repo, ".ai-session", "session.json"), "utf8"));
}

describe("plan/execute commands", () => {
  let repo: string;
  let logs: string[];
  let savedRegistry: string | undefined;

  beforeEach(() => {
    repo = mkGitRepo();
    logs = [];
    // isolate the project registry so resolution never touches the real one
    savedRegistry = process.env.RELAY_BATON_PROJECTS_FILE;
    process.env.RELAY_BATON_PROJECTS_FILE = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "rb-reg-")), "projects.json",
    );
    vi.spyOn(console, "log").mockImplementation((...a: any[]) => { logs.push(a.map(String).join(" ")); });
    vi.spyOn(console, "error").mockImplementation((...a: any[]) => { logs.push(a.map(String).join(" ")); });
    // make process.exit throw so we can assert on it instead of killing the run
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`__exit__:${code ?? 0}`);
    }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (savedRegistry === undefined) delete process.env.RELAY_BATON_PROJECTS_FILE;
    else process.env.RELAY_BATON_PROJECTS_FILE = savedRegistry;
  });

  it("plan --no-run scaffolds a template and marks the session plan_ready / plan-execute", async () => {
    await planCommand("Add a /health endpoint", { noRun: true, path: repo });

    const planMd = fs.readFileSync(path.join(repo, ".ai-session", "plan.md"), "utf8");
    expect(planMd).toContain("# relay-baton plan");
    expect(planMd).toContain("## Goal");
    expect(planMd).toContain("Add a /health endpoint");

    const meta = readMeta(repo);
    expect(meta.workflowMode).toBe("plan-execute");
    expect(meta.status).toBe("plan_ready");
    expect(meta.planAuthor).toBe("claude"); // default planner
    expect(logs.join("\n")).toMatch(/wrote plan template/);
  });

  it("execute aborts (exit 2) when no plan exists", async () => {
    // fresh repo, no plan
    fs.mkdirSync(path.join(repo, ".ai-session"), { recursive: true });
    await expect(executeCommand({ path: repo })).rejects.toThrow(/__exit__:2/);
    expect(logs.join("\n")).toMatch(/no plan found/);
  });

  it("execute aborts (exit 3) when the plan is the unfilled template (gate fail)", async () => {
    await planCommand("Add a /health endpoint", { noRun: true, path: repo });
    await expect(executeCommand({ path: repo })).rejects.toThrow(/__exit__:3/);
    const out = logs.join("\n");
    expect(out).toMatch(/Plan Quality Gate failed/);
    expect(out).toMatch(/Steps section is empty/);
  });

  it("execute proceeds past the gate with a filled plan and enters the execute phase", async () => {
    // Pin the executor to a guaranteed-missing binary so this test is
    // deterministic whether or not a real `codex` is installed on the host.
    fs.writeFileSync(
      path.join(repo, "relay-baton.config.json"),
      JSON.stringify({
        agents: { codex: { command: "rb-nonexistent-agent-xyz", args: ["exec"] } },
      }),
    );

    await planCommand("Add a /health endpoint", { noRun: true, path: repo });
    const filled = [
      "# relay-baton plan",
      "## Goal", "Add a /health endpoint.",
      "## Scope (in)", "- server route",
      "## Out of scope", "- auth",
      "## Approach", "Add GET /health.",
      "## Steps", "1. add route", "2. add test",
      "## Risks", "- none",
      "## Verification", "pnpm test",
      "## Next step", "- open server file",
      "",
    ].join("\n");
    fs.writeFileSync(path.join(repo, ".ai-session", "plan.md"), filled);

    // The bogus executor command makes runAgent emit a spawn error => exit 1.
    // The point: execution was entered (gate passed, executeStartedAt stamped).
    await expect(executeCommand({ path: repo, with: "codex" })).rejects.toThrow(/__exit__:1/);
    const meta = readMeta(repo);
    expect(meta.executor).toBe("codex");
    expect(typeof meta.executeStartedAt).toBe("string");
    expect(logs.join("\n")).not.toMatch(/Plan Quality Gate failed/);
  });

  it("sets exit code 4 when the executor runs but exits non-zero (failed ending)", async () => {
    // A real, spawnable executor that exits 3 with no output — distinct from a
    // spawn error (exit 1). Verifies the failed ending surfaces as exit 4.
    fs.writeFileSync(
      path.join(repo, "relay-baton.config.json"),
      JSON.stringify({
        agents: { codex: { command: process.execPath, args: ["-e", "process.exit(3)"] } },
      }),
    );
    await planCommand("Add a /health endpoint", { noRun: true, path: repo });
    fs.writeFileSync(path.join(repo, ".ai-session", "plan.md"), [
      "# relay-baton plan",
      "## Goal", "Add a /health endpoint.",
      "## Scope (in)", "- server route",
      "## Out of scope", "- auth",
      "## Approach", "Add GET /health.",
      "## Steps", "1. add route", "2. add test",
      "## Risks", "- none",
      "## Verification", "pnpm test",
      "## Next step", "- open server file",
      "",
    ].join("\n"));

    const saved = process.exitCode;
    process.exitCode = undefined;
    try {
      await executeCommand({ path: repo, with: "codex" });
      expect(process.exitCode).toBe(4);
      expect(readMeta(repo).status).toBe("failed");
      expect(logs.join("\n")).toMatch(/execute finished without fallback/);
    } finally {
      process.exitCode = saved;
    }
  });
});
