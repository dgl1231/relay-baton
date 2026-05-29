import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { defaultConfig } from "@relay-baton/core";
import {
  coreChecks,
  deepChecks,
  DEPRECATED_AGENT_ARGS,
  EXPECTED_AGENT_ARGS,
} from "../commands/diagnostics";

function mkRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-diag-"));
  fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
  return dir;
}

function cfgClone() {
  return JSON.parse(JSON.stringify(defaultConfig));
}

describe("coreChecks", () => {
  it("flags a missing git repo as a hard failure", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-nogit-"));
    const checks = coreChecks(dir, cfgClone());
    const git = checks.find(c => c.label === "git repository");
    expect(git?.status).toBe("fail");
  });

  it("never prints API key values, only presence", () => {
    const dir = mkRepo();
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-super-secret-value";
    try {
      const checks = coreChecks(dir, cfgClone());
      const row = checks.find(c => c.label === "OPENAI_API_KEY");
      expect(row).toBeDefined();
      expect(row!.value).not.toContain("sk-super-secret-value");
      expect(row!.status).toBe("warn"); // set + blocked by default
    } finally {
      if (prev === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prev;
    }
  });
});

describe("deepChecks", () => {
  it("passes adapter-args sanity for default config", () => {
    const dir = mkRepo();
    const checks = deepChecks(dir, cfgClone());
    expect(checks.find(c => c.label === "codex args")?.status).toBe("ok");
    expect(checks.find(c => c.label === "claude args")?.status).toBe("ok");
  });

  it("marks forbidden agent args as a hard failure", () => {
    const dir = mkRepo();
    const cfg = cfgClone();
    cfg.agents.codex.args = ["exec", "--full-auto"];
    const checks = deepChecks(dir, cfg);
    const codex = checks.find(c => c.label === "codex args");
    expect(codex?.status).toBe("fail");
    expect(codex?.value).toContain("--full-auto");
  });

  it("warns on custom (non-default) but non-forbidden args", () => {
    const dir = mkRepo();
    const cfg = cfgClone();
    cfg.agents.claude.args = ["-p"];
    const checks = deepChecks(dir, cfg);
    expect(checks.find(c => c.label === "claude args")?.status).toBe("warn");
  });

  it("reports a node version check", () => {
    const dir = mkRepo();
    const checks = deepChecks(dir, cfgClone());
    expect(checks.some(c => c.label === "node version")).toBe(true);
  });
});

describe("policy constants", () => {
  it("forbids the known dangerous flags", () => {
    expect(DEPRECATED_AGENT_ARGS).toContain("--full-auto");
    expect(DEPRECATED_AGENT_ARGS).toContain("--ask-for-approval");
    expect(DEPRECATED_AGENT_ARGS).toContain("bypassPermissions");
  });
  it("pins the expected default adapter args", () => {
    expect(EXPECTED_AGENT_ARGS.codex).toEqual(["exec", "--sandbox", "workspace-write"]);
    expect(EXPECTED_AGENT_ARGS.claude).toEqual(["--permission-mode", "acceptEdits", "-p"]);
  });
});
