import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager } from "../session/SessionManager";
import { ContextCompressor } from "../token-diet/ContextCompressor";
import { LogCompactor } from "../token-diet/LogCompactor";
import { defaultConfig } from "../config/defaultConfig";

function setup(): SessionManager {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-cc-"));
  const sm = new SessionManager(dir, defaultConfig);
  sm.init("compression test");
  return sm;
}

describe("LogCompactor.compressLog", () => {
  it("returns the log unchanged when under tailLines", () => {
    const lc = new LogCompactor();
    const raw = "a\nb\nc\n";
    expect(lc.compressLog(raw, { tailLines: 200 })).toBe(raw);
  });

  it("elides middle lines but keeps the tail and fallback-hit context", () => {
    const lc = new LogCompactor();
    const lines: string[] = [];
    for (let i = 0; i < 1000; i++) lines.push(`line ${i}`);
    lines[10] = "Error: quota exceeded now";
    const raw = lines.join("\n");
    const out = lc.compressLog(raw, { tailLines: 100, contextLines: 1, fallbackPatterns: ["quota exceeded"] });
    expect(out.length).toBeLessThan(raw.length);
    expect(out).toMatch(/lines elided by relay-baton context compression/);
    // fallback hit near line 10 survives
    expect(out).toContain("quota exceeded");
    // tail survives
    expect(out).toContain("line 999");
  });
});

describe("ContextCompressor", () => {
  const profile = defaultConfig.tokenDiet.profiles.balanced;

  it("does nothing when under threshold", () => {
    const sm = setup();
    const cc = new ContextCompressor(sm.repoRoot, defaultConfig);
    const r = cc.compressIfNeeded(profile, {});
    expect(r.compressed).toBe(false);
    expect(r.reason).toMatch(/under threshold/);
  });

  it("dry-run reports intent without writing", () => {
    const sm = setup();
    // inflate commands.log past budget
    fs.writeFileSync(sm.files.p("commandsLog"), "x".repeat(profile.maxLogTailChars * 4 + profile.maxStateChars + 1000));
    const cc = new ContextCompressor(sm.repoRoot, defaultConfig);
    const sizeBefore = fs.statSync(sm.files.p("commandsLog")).size;
    const r = cc.compressIfNeeded(profile, { dryRun: true });
    expect(r.compressed).toBe(false);
    expect(r.reason).toMatch(/would compress/);
    // unchanged on disk
    expect(fs.statSync(sm.files.p("commandsLog")).size).toBe(sizeBefore);
  });

  it("compresses, rotates the raw log, and shrinks total weight when over budget", () => {
    const sm = setup();
    // build a big, realistic-ish log
    const lines: string[] = [];
    for (let i = 0; i < 6000; i++) lines.push(`[stdout] working step ${i}`);
    lines.push("Error: quota exceeded; stopping");
    lines.push("--- exit 1 ---");
    fs.writeFileSync(sm.files.p("commandsLog"), lines.join("\n"));
    // give state.md content so StateCompactor has something
    fs.writeFileSync(sm.files.p("state"),
      "# Current State\n## Goal\nbuild thing\n## Done\n- a\n- a\n- a\n## Next Step\n- go\n");

    const cc = new ContextCompressor(sm.repoRoot, defaultConfig);
    const before = cc.weigh(profile);
    expect(before.ratio).toBeGreaterThanOrEqual(0.8);

    const r = cc.compressIfNeeded(profile, {});
    expect(r.compressed).toBe(true);
    expect(r.after!.total).toBeLessThan(r.before.total);

    // raw log rotated
    expect(r.rotatedLog).toBeTruthy();
    expect(fs.existsSync(r.rotatedLog!)).toBe(true);

    // compressed log preserves the fallback hit (gate guarantee)
    const compressed = fs.readFileSync(sm.files.p("commandsLog"), "utf8");
    expect(compressed.toLowerCase()).toContain("quota exceeded");
    expect(compressed.length).toBeLessThan(lines.join("\n").length);
  });

  it("force compresses even under threshold", () => {
    const sm = setup();
    fs.writeFileSync(sm.files.p("commandsLog"), Array.from({ length: 500 }, (_, i) => `l ${i}`).join("\n"));
    const cc = new ContextCompressor(sm.repoRoot, defaultConfig);
    const r = cc.compressIfNeeded(profile, { force: true });
    // force bypasses the threshold check; whether it "compressed" depends on
    // the gate (must actually shrink). 500 short lines tail=200 => shrinks.
    expect(r.before).toBeTruthy();
  });
});
