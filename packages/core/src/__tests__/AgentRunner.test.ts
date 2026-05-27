import { describe, it, expect } from "vitest";
import { createAgentEnv } from "../agents/AgentRunner";
import { defaultConfig } from "../config/defaultConfig";

describe("createAgentEnv", () => {
  it("removes blocked API keys by default", () => {
    const { env, removed } = createAgentEnv(
      { OPENAI_API_KEY: "sk-x", ANTHROPIC_API_KEY: "y", PATH: "/usr/bin" } as any,
      defaultConfig.authPolicy,
      false,
    );
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.PATH).toBe("/usr/bin");
    expect(removed.sort()).toEqual(["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]);
  });
  it("retains keys when override allows it", () => {
    const { env, removed } = createAgentEnv(
      { OPENAI_API_KEY: "sk-x" } as any,
      defaultConfig.authPolicy,
      true,
    );
    expect(env.OPENAI_API_KEY).toBe("sk-x");
    expect(removed).toEqual([]);
  });
});
