import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { SessionManager, defaultConfig } from "@relay-baton/core";
import { reviewCommand } from "../commands/review";

function git(dir: string, args: string[]) {
  spawnSync("git", args, { cwd: dir, encoding: "utf8" });
}

function setupRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-cli-review-"));
  git(dir, ["init"]);
  git(dir, ["config", "user.email", "t@t.dev"]);
  git(dir, ["config", "user.name", "t"]);
  fs.writeFileSync(path.join(dir, "seed.txt"), "seed\n");
  git(dir, ["add", "."]);
  git(dir, ["commit", "-m", "seed"]);
  const sm = new SessionManager(dir, defaultConfig);
  sm.init("review");
  fs.writeFileSync(
    path.join(dir, ".ai-session", "plan.md"),
    "# plan\n## Steps\n1. create `src/alpha.ts`\n",
    "utf8",
  );
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src", "alpha.ts"), "x\n");
  return dir;
}

describe("reviewCommand", () => {
  let logs: string[];
  beforeEach(() => {
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...a: any[]) => {
      logs.push(a.map(String).join(" "));
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("prints a human review and persists a conversation event", async () => {
    const dir = setupRepo();
    await reviewCommand({ path: dir });
    const out = logs.join("\n");
    expect(out).toMatch(/relay-baton review/);
    expect(out).toContain("src/alpha.ts");

    const conv = path.join(dir, ".ai-session", "conversation.jsonl");
    expect(fs.existsSync(conv)).toBe(true);
    const line = fs.readFileSync(conv, "utf8").trim().split("\n")[0];
    const evt = JSON.parse(line);
    expect(evt.kind).toBe("review");
    expect(evt.role).toBe("relay-baton");
  });

  it("emits valid JSON with --json", async () => {
    const dir = setupRepo();
    await reviewCommand({ path: dir, json: true });
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.planPresent).toBe(true);
    expect(parsed.steps).toHaveLength(1);
    expect(parsed.touchedSteps).toBe(1);
  });
});
