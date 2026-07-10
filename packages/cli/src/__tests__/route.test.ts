import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { routeCommand } from "../commands/route";

describe("route command (v2.8 advisory routing preview)", () => {
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

  function repo(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "rb-cli-route-"));
  }

  it("suggests the reviewer first for a review-shaped task (JSON)", () => {
    routeCommand("review and analyze the auth design", { path: repo(), json: true });
    const out = JSON.parse(logs.join("\n"));
    expect(out.resolvedChain).toEqual(["codex", "claude"]);
    expect(out.suggestedChain).toEqual(["claude", "codex"]);
    expect(out.differs).toBe(true);
    expect(out.matched.claude).toEqual(expect.arrayContaining(["review", "analyze"]));
    expect(out.advisory).toBe(true);
  });

  it("keeps the resolved order when nothing matches", () => {
    routeCommand("continue yesterday's thing", { path: repo(), json: true });
    const out = JSON.parse(logs.join("\n"));
    expect(out.suggestedChain).toEqual(out.resolvedChain);
    expect(out.differs).toBe(false);
  });

  it("honors an explicit --chain like run would", () => {
    routeCommand("review the design", { path: repo(), json: true, chain: "gemini,aider" });
    const out = JSON.parse(logs.join("\n"));
    expect(out.resolvedChain).toEqual(["gemini", "aider"]);
  });
});
