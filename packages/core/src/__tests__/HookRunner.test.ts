import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SESSION_DIR, SESSION_FILES } from "@relay-baton/shared";
import { HookRunner } from "../runtime/HookRunner";
import { defaultConfig } from "../config/defaultConfig";

function repoWith(hooks?: any): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-hook-"));
  fs.mkdirSync(path.join(dir, SESSION_DIR), { recursive: true });
  (defaultConfig as any).__hooks = undefined;
  return dir;
}

function cfg(hooks: any) {
  return { ...defaultConfig, hooks };
}

describe("HookRunner (v2.5)", () => {
  it("is a no-op when no hooks are configured", () => {
    const dir = repoWith();
    const results = new HookRunner(dir, defaultConfig).run("preHandoff");
    expect(results).toEqual([]);
  });

  it("runs configured commands in order and reports success", () => {
    const dir = repoWith();
    const runner = new HookRunner(dir, cfg({ postExecute: ["echo hookA", "echo hookB"] }));
    const results = runner.run("postExecute");
    expect(results.map(r => r.ok)).toEqual([true, true]);
    const log = fs.readFileSync(path.join(dir, SESSION_DIR, SESSION_FILES.commandsLog), "utf8");
    expect(log).toContain("[hook:postExecute] echo hookA");
    expect(log).toContain("hookA");
    expect(log).toContain("hookB");
  });

  it("stops the chain on the first failing command", () => {
    const dir = repoWith();
    // `exit 1` fails; the third command must not run.
    const runner = new HookRunner(dir, cfg({ preHandoff: ["echo first", "exit 1", "echo third"] }));
    const results = runner.run("preHandoff");
    expect(results.length).toBe(2);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
  });

  it("commandsFor filters empty entries", () => {
    const dir = repoWith();
    const runner = new HookRunner(dir, cfg({ preHandoff: ["echo x", "  ", ""] }));
    expect(runner.commandsFor("preHandoff")).toEqual(["echo x"]);
    expect(runner.commandsFor("postExecute")).toEqual([]);
  });
});
