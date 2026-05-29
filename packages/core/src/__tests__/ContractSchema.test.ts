import { describe, it, expect } from "vitest";
import type { RelayBatonConfig, SessionMeta } from "@relay-baton/shared";
import { CONFIG_VERSION, SESSION_SCHEMA_VERSION } from "@relay-baton/shared";
import { validateConfig, normalizeConfig } from "../config/ConfigSchema";
import { validateSessionMeta, normalizeSessionMeta } from "../session/SessionMetaSchema";
import { defaultConfig } from "../config/defaultConfig";

function goodMeta(): SessionMeta {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: "s1",
    createdAt: "2026-05-29T00:00:00Z",
    updatedAt: "2026-05-29T00:00:00Z",
    repoRoot: "/repo",
    task: "do x",
    status: "initialized",
    primaryAgent: "codex",
    fallbackAgent: "claude",
    activeAgent: "none",
    lastAgent: "none",
    fallbackReason: null,
    lastError: null,
    tokenDietProfile: "balanced",
  };
}

describe("validateConfig", () => {
  it("accepts the default config", () => {
    const r = validateConfig(defaultConfig);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("flags unknown agents and a missing agents entry", () => {
    const bad = { ...defaultConfig, primaryAgent: "bogus" as any };
    const r = validateConfig(bad as RelayBatonConfig);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/primaryAgent/);
  });

  it("flags an out-of-range compression threshold", () => {
    const bad = {
      ...defaultConfig,
      contextCompression: { ...defaultConfig.contextCompression!, threshold: 2 },
    };
    const r = validateConfig(bad as RelayBatonConfig);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/threshold/);
  });

  it("warns when a required blocked env var is missing", () => {
    const cfg = {
      ...defaultConfig,
      authPolicy: { ...defaultConfig.authPolicy, blockedEnvVars: ["OPENAI_API_KEY"] },
    };
    const r = validateConfig(cfg as RelayBatonConfig);
    expect(r.warnings.join(" ")).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("warns when configVersion is newer than supported", () => {
    const cfg = { ...defaultConfig, configVersion: CONFIG_VERSION + 1 };
    const r = validateConfig(cfg);
    expect(r.warnings.join(" ")).toMatch(/newer than supported/);
  });

  it("normalizeConfig stamps the current version onto a legacy config", () => {
    const legacy = { ...defaultConfig };
    delete (legacy as any).configVersion;
    expect(normalizeConfig(legacy).configVersion).toBe(CONFIG_VERSION);
  });
});

describe("validateSessionMeta", () => {
  it("accepts a well-formed meta", () => {
    expect(validateSessionMeta(goodMeta()).ok).toBe(true);
  });

  it("requires id and a known status", () => {
    const m = goodMeta();
    (m as any).id = "";
    (m as any).status = "weird";
    const r = validateSessionMeta(m);
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/id is required/);
    expect(r.errors.join(" ")).toMatch(/status/);
  });

  it("rejects a negative durationMs and bad workflowMode", () => {
    const m = goodMeta();
    m.durationMs = -5;
    (m as any).workflowMode = "nope";
    const r = validateSessionMeta(m);
    expect(r.ok).toBe(false);
  });

  it("normalizeSessionMeta stamps schemaVersion on legacy meta", () => {
    const m = goodMeta();
    delete (m as any).schemaVersion;
    expect(normalizeSessionMeta(m).schemaVersion).toBe(SESSION_SCHEMA_VERSION);
  });
});
