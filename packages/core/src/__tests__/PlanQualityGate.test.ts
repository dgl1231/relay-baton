import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager } from "../session/SessionManager";
import { PlanQualityGate } from "../plan/PlanQualityGate";
import { planTemplate, planSectionBody, PLAN_SECTIONS } from "../plan/PlanSchema";
import { defaultConfig } from "../config/defaultConfig";

function setup(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-plan-"));
  const sm = new SessionManager(dir, defaultConfig);
  sm.init("plan test");
  return dir;
}

function planPath(dir: string): string {
  return path.join(dir, ".ai-session", "plan.md");
}

/** A fully-filled, valid plan. */
function validPlan(): string {
  return [
    "# relay-baton plan",
    "## Goal",
    "Add a /health endpoint.",
    "## Scope (in)",
    "- src/server.ts route wiring",
    "## Out of scope",
    "- auth changes",
    "## Approach",
    "Add a GET /health handler returning 200.",
    "## Steps",
    "1. Add the route in src/server.ts",
    "2. Add a test in src/server.test.ts",
    "## Risks",
    "- none significant",
    "## Verification",
    "pnpm test",
    "## Next step",
    "- Open src/server.ts and add the route",
    "",
  ].join("\n");
}

describe("PlanSchema", () => {
  it("planTemplate contains every required section", () => {
    const t = planTemplate("do the thing");
    for (const s of PLAN_SECTIONS) expect(t).toContain(`## ${s}`);
    expect(t).toContain("do the thing");
  });

  it("planSectionBody extracts the body under a heading", () => {
    const plan = validPlan();
    expect(planSectionBody(plan, "Goal")).toBe("Add a /health endpoint.");
    expect(planSectionBody(plan, "Verification")).toBe("pnpm test");
    expect(planSectionBody(plan, "Nonexistent")).toBe("");
  });
});

describe("PlanQualityGate", () => {
  const profile = defaultConfig.tokenDiet.profiles.balanced;

  it("passes a complete valid plan", () => {
    const dir = setup();
    fs.writeFileSync(planPath(dir), validPlan());
    const r = new PlanQualityGate(dir, profile).check();
    expect(r.ok).toBe(true);
    expect(r.failures).toEqual([]);
  });

  it("fails when plan.md is missing", () => {
    const dir = setup();
    const r = new PlanQualityGate(dir, profile).check();
    expect(r.ok).toBe(false);
    expect(r.failures.some(f => /plan\.md.*missing/.test(f))).toBe(true);
  });

  it("fails when plan.md is empty", () => {
    const dir = setup();
    fs.writeFileSync(planPath(dir), "   \n");
    const r = new PlanQualityGate(dir, profile).check();
    expect(r.failures.some(f => /plan\.md: empty/.test(f))).toBe(true);
  });

  it("reports each missing required section", () => {
    const dir = setup();
    fs.writeFileSync(planPath(dir), "# relay-baton plan\n## Goal\nx\n");
    const r = new PlanQualityGate(dir, profile).check();
    const joined = r.failures.join("\n");
    for (const s of ["Scope (in)", "Out of scope", "Approach", "Steps", "Risks", "Verification", "Next step"]) {
      expect(joined).toContain(`missing section ## ${s}`);
    }
  });

  it("fails when the bare template is submitted (placeholder Steps/Next step)", () => {
    const dir = setup();
    fs.writeFileSync(planPath(dir), planTemplate("goal here"));
    const r = new PlanQualityGate(dir, profile).check();
    // template has all sections, but Steps/Next step bodies are "(...)" placeholders
    expect(r.ok).toBe(false);
    expect(r.failures.some(f => /Steps section is empty/.test(f))).toBe(true);
    expect(r.failures.some(f => /Next step section is empty/.test(f))).toBe(true);
  });

  it("fails when plan exceeds maxPlanChars", () => {
    const dir = setup();
    const ultra = defaultConfig.tokenDiet.profiles.ultra;
    const huge = validPlan() + "\n" + "x".repeat((ultra.maxPlanChars ?? ultra.maxHandoffChars) + 1000);
    fs.writeFileSync(planPath(dir), huge);
    const r = new PlanQualityGate(dir, ultra).check();
    expect(r.failures.some(f => /maxPlanChars/.test(f))).toBe(true);
  });

  it("fails when plan inlines a large slice of AGENTS.md", () => {
    const dir = setup();
    const agents = "AGENTS body — ".repeat(60); // > 200 chars
    fs.writeFileSync(path.join(dir, "AGENTS.md"), agents);
    fs.writeFileSync(planPath(dir), validPlan() + "\n" + agents.slice(0, 250));
    const r = new PlanQualityGate(dir, profile).check();
    expect(r.failures.some(f => /inlines AGENTS\.md/.test(f))).toBe(true);
  });
});
