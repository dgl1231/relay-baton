import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { handoffShowCommand } from "../commands/handoffShow";

function mkRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-show-"));
  fs.mkdirSync(path.join(dir, ".ai-session"), { recursive: true });
  return dir;
}

describe("handoffShowCommand", () => {
  let dir: string;
  let logs: string[];
  let errors: string[];

  beforeEach(() => {
    dir = mkRepo();
    logs = [];
    errors = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.map(a => String(a)).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: any[]) => {
      errors.push(args.map(a => String(a)).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints the current handoff.md content read-only", async () => {
    fs.writeFileSync(path.join(dir, ".ai-session", "handoff.md"), "# Relay Baton Handoff\nbody line\n", "utf8");
    await handoffShowCommand({ path: dir });
    expect(logs.join("\n")).toContain("body line");
  });

  it("prints a sentinel (not an error) when no handoff exists", async () => {
    await handoffShowCommand({ path: dir });
    expect(logs.join("\n")).toMatch(/no handoff found/i);
  });

  it("emits valid JSON with --json including exists=false when missing", async () => {
    await handoffShowCommand({ path: dir, json: true });
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.name).toBe("handoff.md");
    expect(parsed.exists).toBe(false);
    expect(parsed.content).toBeNull();
  });

  it("emits the content in JSON when the handoff exists", async () => {
    fs.writeFileSync(path.join(dir, ".ai-session", "handoff.md"), "# H\njson body\n", "utf8");
    await handoffShowCommand({ path: dir, json: true });
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.exists).toBe(true);
    expect(parsed.content).toContain("json body");
  });

  it("shows a named history backup via --file", async () => {
    const backup = "handoff.2026-05-27T05-35-10-865Z.md";
    fs.writeFileSync(path.join(dir, ".ai-session", backup), "# Old\nold body\n", "utf8");
    await handoffShowCommand({ path: dir, file: backup, json: true });
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.name).toBe(backup);
    expect(parsed.content).toContain("old body");
  });

  it("rejects file names outside the handoff history (no path traversal)", async () => {
    fs.writeFileSync(path.join(dir, ".ai-session", "task.md"), "secret task\n", "utf8");
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    await expect(handoffShowCommand({ path: dir, file: "../task.md" })).rejects.toThrow("exit:2");
    await expect(handoffShowCommand({ path: dir, file: "task.md" })).rejects.toThrow("exit:2");
    expect(errors.join("\n")).toMatch(/unknown handoff file/);
    expect(logs.join("\n")).not.toContain("secret task");
    exit.mockRestore();
  });
});
