import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig, UsageLedger, validateConfig } from "../index";
import { HandoffTriggerPolicy } from "../plan/HandoffTriggerPolicy";
import { suggestChain } from "../agents/RoutingHints";
import { AGENT_REGISTRY, ALL_AGENT_IDS } from "../agents/AgentRegistry";
import { SessionFiles } from "../session/SessionFiles";
import type { RelayBatonConfig } from "@relay-baton/shared";

function repoWithSession(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-v28-"));
  new SessionManager(repo, defaultConfig).init("smarter relay test");
  return repo;
}

function withTriggers(t: NonNullable<RelayBatonConfig["handoffTriggers"]>): RelayBatonConfig {
  return { ...defaultConfig, handoffTriggers: t };
}

describe("HandoffTriggerPolicy (v2.8 item 1)", () => {
  it("is a no-op when handoffTriggers is absent (error-pattern-only default)", () => {
    const repo = repoWithSession();
    const report = new HandoffTriggerPolicy(repo, defaultConfig).evaluate();
    expect(report.configured).toBe(false);
    expect(report.triggered).toBe(false);
    expect(report.hits).toHaveLength(0);
  });

  it("triggers on the usage token proxy threshold", () => {
    const repo = repoWithSession();
    new UsageLedger(repo).record("handoff", "claude", 4000); // 1000 tokens proxy
    const report = new HandoffTriggerPolicy(repo, withTriggers({ usageTokensProxy: 500 })).evaluate();
    expect(report.configured).toBe(true);
    expect(report.triggered).toBe(true);
    expect(report.hits.map(h => h.condition)).toContain("usageTokensProxy");
  });

  it("stays quiet when thresholds are configured but not reached", () => {
    const repo = repoWithSession();
    new UsageLedger(repo).record("handoff", "claude", 40); // 10 tokens proxy
    const report = new HandoffTriggerPolicy(repo, withTriggers({ usageTokensProxy: 500, changedFiles: 999 })).evaluate();
    expect(report.configured).toBe(true);
    expect(report.triggered).toBe(false);
  });

  it("triggers on the handoff budget ratio threshold", () => {
    const repo = repoWithSession();
    const config = withTriggers({ budgetRatio: 0.5 });
    const profile = config.tokenDiet.profiles[config.tokenDiet.profile];
    const files = new SessionFiles(repo);
    fs.writeFileSync(files.p("handoff"), "x".repeat(Math.ceil(profile.maxHandoffChars * 0.6)));
    const report = new HandoffTriggerPolicy(repo, config).evaluate();
    expect(report.triggered).toBe(true);
    expect(report.hits.map(h => h.condition)).toContain("budgetRatio");
  });

  it("validateConfig rejects malformed handoffTriggers and accepts sane ones", () => {
    const bad = validateConfig({ ...defaultConfig, handoffTriggers: { budgetRatio: 2 } as any });
    expect(bad.errors.some(e => e.includes("handoffTriggers.budgetRatio"))).toBe(true);
    const bad2 = validateConfig({ ...defaultConfig, handoffTriggers: { changedFiles: -1 } as any });
    expect(bad2.errors.some(e => e.includes("handoffTriggers.changedFiles"))).toBe(true);
    const ok = validateConfig(withTriggers({ budgetRatio: 0.8, changedFiles: 30, usageTokensProxy: 100000 }));
    expect(ok.errors.filter(e => e.includes("handoffTriggers"))).toHaveLength(0);
  });
});

describe("suggestChain (v2.8 item 2 — advisory routing hints)", () => {
  it("every registry agent declares at least one strength tag", () => {
    for (const id of ALL_AGENT_IDS) {
      expect(AGENT_REGISTRY[id].strengths.length, id).toBeGreaterThan(0);
    }
  });

  it("proposes the reviewer/planner first for a review-shaped task", () => {
    const s = suggestChain("review and analyze the auth design", ["codex", "claude"]);
    expect(s.chain).toEqual(["claude", "codex"]);
    expect(s.differs).toBe(true);
    expect(s.matched.claude).toEqual(expect.arrayContaining(["review", "analyze"]));
  });

  it("keeps the input order for an implementation task already led by codex", () => {
    const s = suggestChain("implement the upload retry and fix the flaky test", ["codex", "claude"]);
    expect(s.chain).toEqual(["codex", "claude"]);
    expect(s.differs).toBe(false);
  });

  it("returns the chain unchanged when nothing matches (stable, no false hint)", () => {
    const s = suggestChain("어제 얘기한 그 작업 이어서", ["codex", "claude"]);
    expect(s.chain).toEqual(["codex", "claude"]);
    expect(s.differs).toBe(false);
    expect(Object.keys(s.matched)).toHaveLength(0);
  });
});
