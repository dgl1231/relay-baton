import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig } from "@relay-baton/core";
import { checkpointCommand, checkpointListCommand } from "../commands/checkpoint";

describe("checkpoint command", () => {
  let logs: string[];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.map(a => String(a)).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records a checkpoint and lists it as JSON", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-cli-checkpoint-"));
    new SessionManager(repo, defaultConfig).init("checkpoint via cli");

    await checkpointCommand("1", { path: repo, command: "pnpm build", result: "ok", json: true });
    const added = JSON.parse(logs.join("\n"));
    expect(added.step).toBe(1);
    expect(added.result).toBe("ok");
    expect(added.command).toBe("pnpm build");

    logs.length = 0;
    await checkpointListCommand({ path: repo, json: true });
    const list = JSON.parse(logs.join("\n"));
    expect(list.length).toBe(1);
    expect(list[0].step).toBe(1);
  });
});
