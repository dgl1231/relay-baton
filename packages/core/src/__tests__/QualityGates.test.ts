import { describe, it, expect } from "vitest";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { SessionManager } from "../session/SessionManager";
import { HandoffQualityGate } from "../handoff/HandoffQualityGate";
import { TokenDietQualityGate } from "../handoff/TokenDietQualityGate";
import { defaultConfig } from "../config/defaultConfig";

function setupSession(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-"));
  const sm = new SessionManager(dir, defaultConfig);
  sm.init("test task");
  return dir;
}

describe("HandoffQualityGate", () => {
  it("fails when handoff.md missing sections", () => {
    const dir = setupSession();
    fs.writeFileSync(path.join(dir, ".ai-session", "handoff.md"), "# only top\n");
    const r = new HandoffQualityGate(dir).check();
    expect(r.ok).toBe(false);
    expect(r.failures.some(f => /Next Steps/.test(f))).toBe(true);
  });

  it("passes when all sections present", () => {
    const dir = setupSession();
    fs.writeFileSync(path.join(dir, ".ai-session", "handoff.md"),
      `# Relay Baton Handoff
## Goal
g
## Previous Agent
codex
## Next Agent
claude
## Changed Files
- a
## Known Errors
- e
## Next Steps
- s
`);
    const r = new HandoffQualityGate(dir).check();
    expect(r.ok).toBe(true);
  });
});

describe("TokenDietQualityGate", () => {
  it("fails when handoff exceeds maxHandoffChars", () => {
    const dir = setupSession();
    const profile = defaultConfig.tokenDiet.profiles.ultra;
    const huge = "x".repeat(profile.maxHandoffChars + 1000);
    fs.writeFileSync(path.join(dir, ".ai-session", "handoff.md"),
      `# Relay Baton Handoff\n## Goal\n${huge}\n## Token Diet Summary\nprofile=ultra\n`);
    const g = new TokenDietQualityGate(dir, "ultra", profile);
    const r = g.check({ wasTruncated: true });
    expect(r.ok).toBe(false);
    expect(r.failures.some(f => /maxHandoffChars/.test(f))).toBe(true);
  });

  it("fails when Token Diet Summary missing", () => {
    const dir = setupSession();
    fs.writeFileSync(path.join(dir, ".ai-session", "handoff.md"),
      `# Relay Baton Handoff\n## Goal\nsmall\n`);
    const g = new TokenDietQualityGate(dir, "balanced", defaultConfig.tokenDiet.profiles.balanced);
    const r = g.check({ wasTruncated: false });
    expect(r.failures.some(f => /Token Diet Summary/.test(f))).toBe(true);
  });
});
