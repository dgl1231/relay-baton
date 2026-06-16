import { describe, expect, it } from "vitest";
import { createAgentEnv } from "../agents/AgentRunner";
import { RedactionScanner } from "../handoff/RedactionScanner";
import { defaultConfig } from "../index";

const policy = defaultConfig.authPolicy;
const SECRET_ENV = {
  PATH: "/usr/bin",
  OPENAI_API_KEY: "sk-secretvalue0123456789",
  ANTHROPIC_API_KEY: "sk-ant-secretvalue0123456789",
};

describe("secret-leak regression", () => {
  it("strips provider key env vars from the child by default (value cannot reach the agent)", () => {
    const { env, removed, passedThrough } = createAgentEnv(SECRET_ENV, policy);
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(removed.sort()).toEqual(["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]);
    expect(passedThrough).toEqual([]);
    // no value is present anywhere in the produced env
    expect(JSON.stringify(env)).not.toContain("secretvalue");
  });

  it("records only NAMES (never values) when keys are intentionally allowed through", () => {
    const { env, removed, passedThrough } = createAgentEnv(SECRET_ENV, policy, true);
    expect(env.OPENAI_API_KEY).toBe(SECRET_ENV.OPENAI_API_KEY); // explicitly allowed
    expect(removed).toEqual([]);
    expect(passedThrough.sort()).toEqual(["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]);
    // the audit surface is names only
    expect(passedThrough.join(",")).not.toContain("secretvalue");
  });

  it("flags a leaked key value in artifact text (defense in depth)", () => {
    const report = { clean: true, findings: [] as any[], byCategory: { secret: 0, "api-key": 0, "home-path": 0, oversized: 0 } };
    new RedactionScanner().scanText(report as any, "commands.log", "boom OPENAI_API_KEY=sk-abcdef0123456789abcdef\n");
    expect(report.findings.some(f => f.severity === "high")).toBe(true);
  });
});
