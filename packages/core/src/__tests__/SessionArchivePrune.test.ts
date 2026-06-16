import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig } from "../index";
import { SessionArchiver } from "../session/SessionArchiver";
import { SessionArchiveStore } from "../session/SessionArchiveStore";

// Build N archives in one root with controlled createdAt timestamps.
function archiveRootWith(count: number, baseDate: Date): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-prune-repo-"));
  const archiveRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rb-prune-root-"));
  new SessionManager(repo, defaultConfig).init("prune test");
  for (let i = 0; i < count; i++) {
    const now = new Date(baseDate.getTime() - i * 86_400_000); // each a day older
    new SessionArchiver(repo).archive({ archiveRoot, now });
  }
  return archiveRoot;
}

describe("SessionArchiveStore.prune", () => {
  it("does nothing without a retention policy", () => {
    const root = archiveRootWith(3, new Date());
    const r = new SessionArchiveStore({ archiveRoot: root }).prune();
    expect(r.pruned).toHaveLength(0);
    expect(r.kept).toHaveLength(3);
    expect(r.reason).toMatch(/no retention/);
  });

  it("dry-run by default keeps everything on disk", () => {
    const root = archiveRootWith(3, new Date());
    const before = fs.readdirSync(root).length;
    const r = new SessionArchiveStore({ archiveRoot: root }).prune({ maxCount: 1 });
    expect(r.dryRun).toBe(true);
    expect(r.pruned).toHaveLength(2);
    expect(r.pruned.every(p => !p.deleted)).toBe(true);
    expect(fs.readdirSync(root).length).toBe(before);
  });

  it("--apply with maxCount deletes the oldest beyond N", () => {
    const root = archiveRootWith(3, new Date());
    const r = new SessionArchiveStore({ archiveRoot: root }).prune({ maxCount: 1, dryRun: false });
    expect(r.kept).toHaveLength(1);
    expect(r.pruned).toHaveLength(2);
    expect(r.pruned.every(p => p.deleted)).toBe(true);
    expect(fs.readdirSync(root).length).toBe(1);
  });

  it("maxAgeDays prunes archives older than the threshold", () => {
    const now = new Date("2026-06-16T00:00:00Z");
    const root = archiveRootWith(5, now); // ages 0..4 days
    const r = new SessionArchiveStore({ archiveRoot: root }).prune({ maxAgeDays: 2, dryRun: false, now });
    // keep ages 0,1,2 (>2 means strictly older); prune ages 3,4
    expect(r.pruned).toHaveLength(2);
    expect(r.kept.length).toBe(3);
  });
});
