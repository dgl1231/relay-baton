import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager } from "../session/SessionManager";
import { defaultConfig } from "../config/defaultConfig";
import type { SessionMeta } from "@relay-baton/shared";

function setup(): SessionManager {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-obs-"));
  const sm = new SessionManager(dir, defaultConfig);
  sm.init("observability test");
  return sm;
}

describe("SessionMeta v0.4 observability fields", () => {
  it("init() produces a session without timing fields by default", () => {
    const sm = setup();
    const meta = sm.getMeta()!;
    expect(meta.startedAt).toBeUndefined();
    expect(meta.endedAt).toBeUndefined();
    expect(meta.durationMs).toBeUndefined();
    expect(meta.handoffCount).toBeUndefined();
  });

  it("updateMeta() persists startedAt and the additive timing fields", () => {
    const sm = setup();
    const t0 = "2026-05-28T01:00:00.000Z";
    sm.updateMeta({ startedAt: t0 });
    const onDisk: SessionMeta = JSON.parse(fs.readFileSync(sm.files.p("sessionJson"), "utf8"));
    expect(onDisk.startedAt).toBe(t0);
  });

  it("updateMeta({ endedAt: undefined }) clears a previously-set endedAt on a fresh run", () => {
    const sm = setup();
    sm.updateMeta({ startedAt: "2026-05-28T01:00:00.000Z", endedAt: "2026-05-28T01:00:05.000Z", durationMs: 5000 });
    // confirm round 1 persisted
    let parsed: SessionMeta = JSON.parse(fs.readFileSync(sm.files.p("sessionJson"), "utf8"));
    expect(parsed.endedAt).toBe("2026-05-28T01:00:05.000Z");
    expect(parsed.durationMs).toBe(5000);

    // simulate the start of a fresh run/handoff: caller sets endedAt=undefined
    sm.updateMeta({ startedAt: "2026-05-28T02:00:00.000Z", endedAt: undefined, durationMs: undefined });

    parsed = JSON.parse(fs.readFileSync(sm.files.p("sessionJson"), "utf8"));
    expect(parsed.startedAt).toBe("2026-05-28T02:00:00.000Z");
    // JSON.stringify drops undefined fields, so these are gone from the file.
    expect(parsed.endedAt).toBeUndefined();
    expect(parsed.durationMs).toBeUndefined();
  });

  it("durationMs computed from ISO timestamps is non-negative and matches the diff", () => {
    const sm = setup();
    const startedAt = "2026-05-28T01:00:00.000Z";
    const endedAt = "2026-05-28T01:02:30.500Z";
    const durationMs = Date.parse(endedAt) - Date.parse(startedAt);
    sm.updateMeta({ startedAt, endedAt, durationMs });
    const parsed: SessionMeta = JSON.parse(fs.readFileSync(sm.files.p("sessionJson"), "utf8"));
    expect(parsed.durationMs).toBe(150500);
    expect(parsed.durationMs).toBeGreaterThan(0);
  });

  it("handoffCount monotonically increments via updateMeta", () => {
    const sm = setup();
    expect(sm.getMeta()?.handoffCount).toBeUndefined();
    // simulate two successive successful handoff writes
    const c0 = sm.getMeta()?.handoffCount ?? 0;
    sm.updateMeta({ handoffCount: c0 + 1 });
    expect(sm.getMeta()?.handoffCount).toBe(1);
    const c1 = sm.getMeta()?.handoffCount ?? 0;
    sm.updateMeta({ handoffCount: c1 + 1 });
    expect(sm.getMeta()?.handoffCount).toBe(2);
  });
});
