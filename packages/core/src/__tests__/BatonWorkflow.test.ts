import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import { BatonWorkflow } from "../workflow/BatonWorkflow";
import { SessionManager } from "../session/SessionManager";
import { defaultConfig } from "../config/defaultConfig";
import { REFS } from "../token-diet/ReferenceResolver";
import { TRUNCATE_MARKER } from "@relay-baton/shared";

function git(dir: string, args: string): void {
  execSync(`git ${args}`, { cwd: dir, stdio: "ignore" });
}

function setupFixture(opts: { largeDiff?: boolean; longLog?: boolean } = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-wf-"));

  // git init + identity (commit needs name/email; init alone doesn't)
  git(dir, "init -q -b main");
  git(dir, 'config user.email "test@example.invalid"');
  git(dir, 'config user.name "rb-test"');

  // initial committed file
  fs.writeFileSync(path.join(dir, "foo.ts"), "export const v = 1;\n");
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"fix-me"}\n');
  git(dir, "add .");
  git(dir, 'commit -q -m "init"');

  // uncommitted change → produces a real diff vs HEAD
  if (opts.largeDiff) {
    // ~40 KB of changes — exceeds caveman/balanced maxDiffChars easily
    const body = "// generated line\n".repeat(2000);
    fs.writeFileSync(path.join(dir, "foo.ts"), "export const v = 2;\n" + body);
  } else {
    fs.writeFileSync(path.join(dir, "foo.ts"), "export const v = 2;\n");
  }

  // bootstrap .ai-session via SessionManager so all required files exist
  const sm = new SessionManager(dir, defaultConfig);
  sm.init("Fix the upload bug");
  // Give state.md actual content so compact-state.md has something
  fs.writeFileSync(
    sm.files.p("state"),
    "# Current State\n\n## Goal\nFix the upload bug.\n\n## Done\n- read foo.ts\n\n## In Progress\n- patch foo.ts\n\n## Next Step\n- run tests\n",
    "utf8",
  );

  if (opts.longLog) {
    // ~30 KB log including the fallback phrase, so LogCompactor pulls real known errors
    const tailLine = "Error: quota exceeded; please try again later\n";
    const filler = "[stdout] working...\n".repeat(1500);
    fs.writeFileSync(sm.files.p("commandsLog"), filler + tailLine, "utf8");
  }

  // test-results.md surfaces in handoff if non-empty
  fs.writeFileSync(sm.files.p("testResults"), "vitest: 39/39 passed\n", "utf8");

  return dir;
}

describe("BatonWorkflow", () => {
  describe("buildHandoff() against a fixture repo", () => {
    let dir: string;
    beforeEach(() => {
      dir = setupFixture();
    });

    it("writes every required .ai-session artifact and a context-budget snapshot", () => {
      const sm = new SessionManager(dir, defaultConfig);
      const wf = new BatonWorkflow(sm, defaultConfig);
      const result = wf.buildHandoff({
        profileName: "balanced",
        fallbackReason: "Detected pattern \"quota exceeded\"",
        previousAgent: "codex",
        nextAgent: "claude",
      });

      for (const name of ["handoff", "fullDiff", "repoMap", "changedFiles", "compactState", "contextBudget"] as const) {
        expect(fs.existsSync(sm.files.p(name))).toBe(true);
      }
      expect(result.handoffPath).toBe(sm.files.p("handoff"));

      const snap = JSON.parse(fs.readFileSync(sm.files.p("contextBudget"), "utf8"));
      expect(snap.profile).toBe("balanced");
      expect(snap.maxHandoffChars).toBe(defaultConfig.tokenDiet.profiles.balanced.maxHandoffChars);
      expect(snap.used.handoff).toBe(result.usedChars);
      expect(typeof snap.generatedAt).toBe("string");
    });

    it("handoff.md contains the goal, fallback reason, references to other artifacts, and the changed file", () => {
      const sm = new SessionManager(dir, defaultConfig);
      const wf = new BatonWorkflow(sm, defaultConfig);
      wf.buildHandoff({
        profileName: "balanced",
        fallbackReason: "Detected pattern \"quota exceeded\"",
        previousAgent: "codex",
        nextAgent: "claude",
      });

      const md = fs.readFileSync(sm.files.p("handoff"), "utf8");
      expect(md).toContain("Fix the upload bug");
      expect(md).toContain("quota exceeded");
      expect(md).toContain(REFS.fullDiff);
      expect(md).toContain(REFS.repoMap);
      expect(md).toContain(REFS.compactState);
      // changed file shows up in the Changed Files list
      expect(md).toMatch(/## Changed Files[\s\S]+- foo\.ts/);
      // foo.ts shows up in Relevant Files with reason "changed"
      expect(md).toMatch(/foo\.ts.*changed/);
    });

    it("respects the active profile's maxHandoffChars on every profile", () => {
      // generate once per profile, in the same fixture
      for (const profileName of ["off", "lite", "balanced", "caveman", "ultra"] as const) {
        const sm = new SessionManager(dir, defaultConfig);
        const wf = new BatonWorkflow(sm, defaultConfig);
        const result = wf.buildHandoff({
          profileName,
          fallbackReason: null,
          previousAgent: "codex",
          nextAgent: "claude",
        });
        const max = defaultConfig.tokenDiet.profiles[profileName].maxHandoffChars;
        expect(result.usedChars).toBeLessThanOrEqual(max);
        expect(fs.statSync(sm.files.p("handoff")).size).toBeLessThanOrEqual(max);
      }
    });
  });

  describe("backup behavior", () => {
    it("backs up a pre-existing handoff.md before overwriting", () => {
      const dir = setupFixture();
      const sm = new SessionManager(dir, defaultConfig);

      // pre-populate handoff.md
      const prior = "# previous handoff content\nshould be backed up\n";
      fs.writeFileSync(sm.files.p("handoff"), prior, "utf8");

      new BatonWorkflow(sm, defaultConfig).buildHandoff({
        profileName: "balanced",
        fallbackReason: null,
        previousAgent: "codex",
        nextAgent: "claude",
      });

      const sessionDir = path.dirname(sm.files.p("handoff"));
      const backups = fs.readdirSync(sessionDir).filter(name => /^handoff\.\d{4}-\d{2}-\d{2}T.+\.md$/.test(name));
      expect(backups.length).toBeGreaterThan(0);
      const backedUp = fs.readFileSync(path.join(sessionDir, backups[0]), "utf8");
      expect(backedUp).toBe(prior);

      // current handoff.md is the newly built one, not the prior content
      const current = fs.readFileSync(sm.files.p("handoff"), "utf8");
      expect(current).not.toBe(prior);
      expect(current).toContain("Relay Baton Handoff");
    });
  });

  describe("token diet enforcement", () => {
    it("caveman: large raw diff is kept on disk but NOT inlined into handoff.md", () => {
      const dir = setupFixture({ largeDiff: true });
      const sm = new SessionManager(dir, defaultConfig);
      const wf = new BatonWorkflow(sm, defaultConfig);

      const result = wf.buildHandoff({
        profileName: "caveman",
        fallbackReason: null,
        previousAgent: "codex",
        nextAgent: "claude",
      });

      const cavemanProfile = defaultConfig.tokenDiet.profiles.caveman;
      expect(result.usedChars).toBeLessThanOrEqual(cavemanProfile.maxHandoffChars);

      const handoffMd = fs.readFileSync(sm.files.p("handoff"), "utf8");
      const fullDiff = fs.readFileSync(sm.files.p("fullDiff"), "utf8");

      // full-diff.patch persists at full size
      expect(fullDiff.length).toBeGreaterThan(cavemanProfile.maxDiffChars);

      // The diff body inside handoff.md should be bounded by the caveman diff budget.
      // (The Important Diff block can contain trimmed snippets but must not dump the whole patch.)
      expect(handoffMd.length).toBeLessThan(fullDiff.length);

      // The verbatim filler line repeated thousands of times must NOT all land in the handoff;
      // the compacted version drops most of it.
      const occurrences = (handoffMd.match(/\/\/ generated line/g) ?? []).length;
      expect(occurrences).toBeLessThan(200);
    });

    it("ultra: extreme budget is enforced and snapshot.truncated reflects truncation", () => {
      const dir = setupFixture({ largeDiff: true, longLog: true });
      const sm = new SessionManager(dir, defaultConfig);
      const ultra = defaultConfig.tokenDiet.profiles.ultra;
      // Force truncation by inflating the goal beyond ultra's full handoff
      // budget. The upstream diet modules (DiffCompactor, LogCompactor,
      // StateCompactor) already trim their own inputs to their sub-budgets,
      // so they alone might leave the assembled handoff under maxHandoffChars
      // and never engage HandoffCompactor truncation. A giant task body
      // guarantees the compactor has to trim regardless.
      fs.writeFileSync(sm.files.p("task"), "x ".repeat(ultra.maxHandoffChars), "utf8");
      const wf = new BatonWorkflow(sm, defaultConfig);

      const result = wf.buildHandoff({
        profileName: "ultra",
        fallbackReason: "Detected pattern \"quota exceeded\"",
        previousAgent: "codex",
        nextAgent: "claude",
      });

      expect(result.usedChars).toBeLessThanOrEqual(ultra.maxHandoffChars);
      const snap = JSON.parse(fs.readFileSync(sm.files.p("contextBudget"), "utf8"));
      expect(snap.profile).toBe("ultra");
      expect(snap.truncated).toBe(true);
      expect(snap.used.handoff).toBeLessThanOrEqual(ultra.maxHandoffChars);

      // raw artifacts remain at full size on disk
      expect(snap.used.fullDiff).toBeGreaterThan(ultra.maxHandoffChars);
      expect(snap.used.commandsLog).toBeGreaterThan(ultra.maxHandoffChars);

      const md = fs.readFileSync(sm.files.p("handoff"), "utf8");
      expect(md).toContain(TRUNCATE_MARKER);
    });

    it("captures fallback patterns from commands.log into Known Errors via LogCompactor", () => {
      const dir = setupFixture({ longLog: true });
      const sm = new SessionManager(dir, defaultConfig);
      new BatonWorkflow(sm, defaultConfig).buildHandoff({
        profileName: "balanced",
        fallbackReason: null,
        previousAgent: "codex",
        nextAgent: "claude",
      });

      const md = fs.readFileSync(sm.files.p("handoff"), "utf8");
      const m = /## Known Errors\s+([\s\S]*?)(?=\n## |\n# |$)/.exec(md);
      expect(m).not.toBeNull();
      // The pattern that we seeded the log with must surface somewhere in Known Errors.
      expect(m![1]).toMatch(/quota exceeded/);
    });
  });

  describe("refreshArtifacts() side effects", () => {
    it("rewrites repo-map.md, compact-state.md, changed-files.md, full-diff.patch", () => {
      const dir = setupFixture();
      const sm = new SessionManager(dir, defaultConfig);

      // Pre-fill these files with sentinel content; the workflow must overwrite.
      fs.writeFileSync(sm.files.p("repoMap"), "STALE\n");
      fs.writeFileSync(sm.files.p("compactState"), "STALE\n");
      fs.writeFileSync(sm.files.p("changedFiles"), "STALE\n");
      fs.writeFileSync(sm.files.p("fullDiff"), "STALE\n");

      const wf = new BatonWorkflow(sm, defaultConfig);
      wf.refreshArtifacts("balanced");

      for (const name of ["repoMap", "compactState", "changedFiles", "fullDiff"] as const) {
        const content = fs.readFileSync(sm.files.p(name), "utf8");
        expect(content).not.toMatch(/^STALE/);
      }
      expect(fs.readFileSync(sm.files.p("changedFiles"), "utf8")).toContain("foo.ts");
    });
  });

  describe("redaction scan of the generated handoff", () => {
    it("has no high-severity findings for a normal handoff", () => {
      const dir = setupFixture();
      const sm = new SessionManager(dir, defaultConfig);
      const r = new BatonWorkflow(sm, defaultConfig).buildHandoff({
        profileName: "balanced", fallbackReason: null, previousAgent: "codex", nextAgent: "claude",
      });
      // No secrets/keys (the gate blocks only on "high"). Absolute home paths can
      // legitimately appear (e.g. the repo root) and are medium-severity warnings.
      expect(r.redaction.findings.some(f => f.severity === "high")).toBe(false);
    });

    it("flags a high-severity secret that flows into the handoff", () => {
      const dir = setupFixture();
      const sm = new SessionManager(dir, defaultConfig);
      // A secret in state.md flows into compact-state.md and the handoff body.
      fs.writeFileSync(
        sm.files.p("state"),
        "# Current State\n\n## Next Step\nuse OPENAI_API_KEY=sk-abcdef0123456789abcdefghij\n",
        "utf8",
      );
      const r = new BatonWorkflow(sm, defaultConfig).buildHandoff({
        profileName: "balanced", fallbackReason: null, previousAgent: "codex", nextAgent: "claude",
      });
      expect(r.redaction.clean).toBe(false);
      expect(r.redaction.findings.some(f => f.severity === "high")).toBe(true);
    });
  });
});
