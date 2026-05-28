import { describe, it, expect } from "vitest";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { SessionManager } from "../session/SessionManager";
import { HandoffQualityGate } from "../handoff/HandoffQualityGate";
import { TokenDietQualityGate } from "../handoff/TokenDietQualityGate";
import { defaultConfig } from "../config/defaultConfig";
import { TRUNCATE_MARKER } from "@relay-baton/shared";

function setupSession(taskText = "test task"): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-gate-"));
  const sm = new SessionManager(dir, defaultConfig);
  sm.init(taskText);
  return dir;
}

/** Minimal valid handoff.md body, can be amended per test. */
function fullHandoffMd(extraSections = ""): string {
  return [
    "# Relay Baton Handoff",
    "## Goal",
    "g",
    "## Previous Agent",
    "codex",
    "## Next Agent",
    "claude",
    "## Token Diet Summary",
    "profile=balanced",
    "## Changed Files",
    "- a",
    "## Known Errors",
    "- e",
    "## Next Steps",
    "- s",
    extraSections,
    "",
  ].join("\n");
}

function p(repo: string, name: string): string {
  return path.join(repo, ".ai-session", name);
}

describe("HandoffQualityGate", () => {
  it("passes when all required files and sections are present", () => {
    const dir = setupSession();
    fs.writeFileSync(p(dir, "handoff.md"), fullHandoffMd());
    const r = new HandoffQualityGate(dir).check();
    expect(r.ok).toBe(true);
    expect(r.failures).toEqual([]);
  });

  it("fails when task.md is missing", () => {
    const dir = setupSession();
    fs.writeFileSync(p(dir, "handoff.md"), fullHandoffMd());
    fs.rmSync(p(dir, "task.md"));
    const r = new HandoffQualityGate(dir).check();
    expect(r.ok).toBe(false);
    expect(r.failures.some(f => /task\.md.*missing/.test(f))).toBe(true);
  });

  it("fails when task.md is empty (whitespace only)", () => {
    const dir = setupSession();
    fs.writeFileSync(p(dir, "handoff.md"), fullHandoffMd());
    fs.writeFileSync(p(dir, "task.md"), "   \n\n");
    const r = new HandoffQualityGate(dir).check();
    expect(r.failures.some(f => /task\.md: empty/.test(f))).toBe(true);
  });

  it("fails when handoff.md is missing", () => {
    const dir = setupSession();
    // never write handoff.md
    const r = new HandoffQualityGate(dir).check();
    expect(r.failures.some(f => /handoff\.md.*missing/.test(f))).toBe(true);
  });

  it("fails when handoff.md is empty", () => {
    const dir = setupSession();
    fs.writeFileSync(p(dir, "handoff.md"), "");
    const r = new HandoffQualityGate(dir).check();
    expect(r.failures.some(f => /handoff\.md: empty/.test(f))).toBe(true);
  });

  it("fails when session.json is missing", () => {
    const dir = setupSession();
    fs.writeFileSync(p(dir, "handoff.md"), fullHandoffMd());
    fs.rmSync(p(dir, "session.json"));
    const r = new HandoffQualityGate(dir).check();
    expect(r.failures.some(f => /session\.json.*missing/.test(f))).toBe(true);
  });

  it("reports every required section that is missing from handoff.md", () => {
    const dir = setupSession();
    // handoff.md present but body is essentially empty
    fs.writeFileSync(p(dir, "handoff.md"), "# only top\n");
    const r = new HandoffQualityGate(dir).check();
    expect(r.ok).toBe(false);
    const joined = r.failures.join("\n");
    for (const section of [
      "## Goal",
      "## Previous Agent",
      "## Next Agent",
      "## Changed Files",
      "## Known Errors",
      "## Next Steps",
    ]) {
      expect(joined).toContain(`missing section ${section}`);
    }
  });

  it("reports a single missing section precisely", () => {
    const dir = setupSession();
    // strip Next Steps only
    const md = fullHandoffMd().replace(/## Next Steps[\s\S]*?(?=\n## |$)/, "");
    fs.writeFileSync(p(dir, "handoff.md"), md);
    const r = new HandoffQualityGate(dir).check();
    expect(r.failures.some(f => /missing section ## Next Steps/.test(f))).toBe(true);
    expect(r.failures.some(f => /missing section ## Goal/.test(f))).toBe(false);
  });
});

describe("TokenDietQualityGate", () => {
  function gate(dir: string, profileName: "off" | "lite" | "balanced" | "caveman" | "ultra" = "balanced") {
    const profile = defaultConfig.tokenDiet.profiles[profileName];
    return new TokenDietQualityGate(dir, profileName, profile);
  }

  it("passes with a valid handoff under the profile budget", () => {
    const dir = setupSession();
    fs.writeFileSync(p(dir, "handoff.md"), fullHandoffMd());
    const r = gate(dir).check({ wasTruncated: false });
    expect(r.ok).toBe(true);
    expect(r.failures).toEqual([]);
  });

  it("fails when handoff exceeds maxHandoffChars (ultra)", () => {
    const dir = setupSession();
    const profile = defaultConfig.tokenDiet.profiles.ultra;
    const huge = "x".repeat(profile.maxHandoffChars + 1000);
    fs.writeFileSync(
      p(dir, "handoff.md"),
      `# Relay Baton Handoff\n## Goal\n${huge}\n## Token Diet Summary\np=ultra\n`,
    );
    const r = gate(dir, "ultra").check({ wasTruncated: true });
    expect(r.ok).toBe(false);
    expect(r.failures.some(f => /maxHandoffChars/.test(f))).toBe(true);
  });

  it("fails when Token Diet Summary section is missing", () => {
    const dir = setupSession();
    fs.writeFileSync(p(dir, "handoff.md"), `# Relay Baton Handoff\n## Goal\nsmall\n`);
    const r = gate(dir).check({ wasTruncated: false });
    expect(r.failures.some(f => /Token Diet Summary/.test(f))).toBe(true);
  });

  it("warns when wasTruncated is true but no TRUNCATED marker is present", () => {
    const dir = setupSession();
    fs.writeFileSync(p(dir, "handoff.md"), fullHandoffMd()); // valid, no marker
    const r = gate(dir).check({ wasTruncated: true });
    expect(r.warnings.some(w => /TRUNCATED marker/i.test(w))).toBe(true);
  });

  it("does not warn about the marker when wasTruncated is true AND marker is present", () => {
    const dir = setupSession();
    const md = fullHandoffMd() + "\n" + TRUNCATE_MARKER + "\n";
    fs.writeFileSync(p(dir, "handoff.md"), md);
    const r = gate(dir).check({ wasTruncated: true });
    expect(r.warnings.some(w => /TRUNCATED marker/i.test(w))).toBe(false);
  });

  it("fails when handoff inlines a large slice of commands.log", () => {
    const dir = setupSession();
    const log = "L".repeat(2000);
    fs.writeFileSync(p(dir, "commands.log"), log);
    // include the first 200 chars verbatim in handoff
    const handoff = fullHandoffMd() + "\n```\n" + log.slice(0, 250) + "\n```\n";
    fs.writeFileSync(p(dir, "handoff.md"), handoff);
    const r = gate(dir).check({ wasTruncated: false });
    expect(r.failures.some(f => /inlines large portion of commands\.log/.test(f))).toBe(true);
  });

  it("fails when handoff inlines AGENTS.md", () => {
    const dir = setupSession();
    const agents = "AGENTS.md body — ".repeat(60); // > 200 chars
    fs.writeFileSync(path.join(dir, "AGENTS.md"), agents);
    // include the first 250 chars verbatim
    fs.writeFileSync(p(dir, "handoff.md"), fullHandoffMd() + "\n" + agents.slice(0, 250) + "\n");
    // Run the gate with cwd at dir so the inlineCheck("AGENTS.md") relative path resolves correctly.
    const savedCwd = process.cwd();
    process.chdir(dir);
    try {
      const r = gate(dir).check({ wasTruncated: false });
      expect(r.failures.some(f => /inlines AGENTS\.md/.test(f))).toBe(true);
    } finally {
      process.chdir(savedCwd);
    }
  });

  it("fails on caveman when Important Diff block exceeds maxDiffChars", () => {
    const dir = setupSession();
    const cavemanProfile = defaultConfig.tokenDiet.profiles.caveman;
    const tooBig = "d".repeat(cavemanProfile.maxDiffChars + 500);
    const handoff = fullHandoffMd(`\n## Important Diff\n\`\`\`diff\n${tooBig}\n\`\`\`\n`);
    fs.writeFileSync(p(dir, "handoff.md"), handoff);
    const r = gate(dir, "caveman").check({ wasTruncated: false });
    expect(r.failures.some(f => /caveman.*Important Diff block too large/.test(f))).toBe(true);
  });

  it("warns on ultra when low-priority sections appear", () => {
    const dir = setupSession();
    const handoff = fullHandoffMd("\n## Full Diff\n(big)\n## Long Logs\n(long)\n");
    fs.writeFileSync(p(dir, "handoff.md"), handoff);
    const r = gate(dir, "ultra").check({ wasTruncated: false });
    // Two warnings, one per offending section.
    expect(r.warnings.some(w => /## Full Diff/.test(w))).toBe(true);
    expect(r.warnings.some(w => /## Long Logs/.test(w))).toBe(true);
  });

  it("fails when full-diff.patch is missing", () => {
    const dir = setupSession();
    fs.writeFileSync(p(dir, "handoff.md"), fullHandoffMd());
    fs.rmSync(p(dir, "full-diff.patch"));
    const r = gate(dir).check({ wasTruncated: false });
    expect(r.failures.some(f => /full-diff\.patch.*missing/.test(f))).toBe(true);
  });

  it("fails when compact-state.md is missing", () => {
    const dir = setupSession();
    fs.writeFileSync(p(dir, "handoff.md"), fullHandoffMd());
    fs.rmSync(p(dir, "compact-state.md"));
    const r = gate(dir).check({ wasTruncated: false });
    expect(r.failures.some(f => /compact-state\.md.*missing/.test(f))).toBe(true);
  });

  it("fails when context-budget.json is missing", () => {
    const dir = setupSession();
    fs.writeFileSync(p(dir, "handoff.md"), fullHandoffMd());
    fs.rmSync(p(dir, "context-budget.json"));
    const r = gate(dir).check({ wasTruncated: false });
    expect(r.failures.some(f => /context-budget\.json.*missing/.test(f))).toBe(true);
  });
});
