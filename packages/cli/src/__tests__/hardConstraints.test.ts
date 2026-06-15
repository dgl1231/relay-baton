import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { defaultConfig } from "@relay-baton/core";

// v2.0 "hard constraints reaffirmed": these are the non-negotiable safety rules
// from CLAUDE.md. This test fails loudly if a future change regresses them.
const ROOT = path.resolve(__dirname, "../../../..");
const FORBIDDEN_DEPS = [
  "openai",
  "@anthropic-ai/sdk",
  "@anthropic-ai/bedrock-sdk",
  "@google/generative-ai",
  "cohere-ai",
  "langchain",
];

function allPackageJsons(): string[] {
  const out: string[] = [];
  out.push(path.join(ROOT, "package.json"));
  const pkgDir = path.join(ROOT, "packages");
  for (const name of fs.readdirSync(pkgDir)) {
    const p = path.join(pkgDir, name, "package.json");
    if (fs.existsSync(p)) out.push(p);
  }
  return out;
}

describe("hard constraints", () => {
  it("blocks the provider API-key env vars by default and never passes them through", () => {
    expect(defaultConfig.authPolicy.allowApiKeyEnv).toBe(false);
    expect(defaultConfig.authPolicy.blockedEnvVars).toEqual(
      expect.arrayContaining(["OPENAI_API_KEY", "ANTHROPIC_API_KEY"]),
    );
    expect(defaultConfig.authPolicy.mode).toBe("cli-session");
  });

  it("declares no direct LLM API client dependency in any package", () => {
    for (const file of allPackageJsons()) {
      const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      const found = FORBIDDEN_DEPS.filter(d => d in deps);
      expect({ file: path.relative(ROOT, file), found }).toEqual({ file: path.relative(ROOT, file), found: [] });
    }
  });
});
