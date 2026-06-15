import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig } from "../index";
import { ExecutionCheckpoints } from "../plan/ExecutionCheckpoints";
import { GuardrailPolicy } from "../plan/GuardrailPolicy";
import type { RelayBatonConfig } from "@relay-baton/shared";

function repoWithSession(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-guard-"));
  new SessionManager(repo, defaultConfig).init("guard test");
  return repo;
}

function withGuardrails(overrides: NonNullable<RelayBatonConfig["guardrails"]>): RelayBatonConfig {
  return { ...defaultConfig, guardrails: { ...defaultConfig.guardrails, ...overrides } };
}

describe("GuardrailPolicy", () => {
  it("reports ok when under all caps", () => {
    const repo = repoWithSession();
    const report = new GuardrailPolicy(repo, defaultConfig).evaluate();
    expect(report.blocked).toBe(false);
    expect(report.violations).toHaveLength(0);
    expect(report.actual.steps).toBe(0);
  });

  it("blocks when checkpoint count reaches maxSteps", () => {
    const repo = repoWithSession();
    const config = withGuardrails({ maxSteps: 2 });
    const cps = new ExecutionCheckpoints(repo, config);
    cps.append({ step: 1, result: "ok" });
    cps.append({ step: 2, result: "ok" });
    const report = new GuardrailPolicy(repo, config).evaluate();
    expect(report.blocked).toBe(true);
    expect(report.violations.map(v => v.condition)).toContain("maxSteps");
  });

  it("blocks when budget ratio reaches the cap", () => {
    const repo = repoWithSession();
    const config = withGuardrails({ maxBudgetRatio: 0.01 });
    fs.writeFileSync(path.join(repo, ".ai-session", "handoff.md"), "x".repeat(5000));
    const report = new GuardrailPolicy(repo, config).evaluate();
    expect(report.blocked).toBe(true);
    expect(report.violations.map(v => v.condition)).toContain("maxBudgetRatio");
  });

  it("surfaces requireConfirmation from config", () => {
    const repo = repoWithSession();
    const report = new GuardrailPolicy(repo, withGuardrails({ requireConfirmation: true })).evaluate();
    expect(report.requireConfirmation).toBe(true);
  });
});
