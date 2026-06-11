import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig } from "../index";
import { SessionArchiver } from "../session/SessionArchiver";
import { SessionArchiveStore } from "../session/SessionArchiveStore";

function makeArchive(): { archiveRoot: string; repo: string } {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-store-repo-"));
  const archiveRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rb-store-arch-"));
  new SessionManager(repo, defaultConfig).init("store test");
  new SessionArchiver(repo).archive({ archiveRoot });
  return { archiveRoot, repo };
}

describe("SessionArchiveStore", () => {
  it("reports unavailable when the archive root is missing", () => {
    const result = new SessionArchiveStore({ archiveRoot: path.join(os.tmpdir(), "rb-missing-xyz") }).list();
    expect(result.available).toBe(false);
    expect(result.archives).toHaveLength(0);
  });

  it("lists archives newest first", () => {
    const { archiveRoot } = makeArchive();
    const result = new SessionArchiveStore({ archiveRoot }).list();
    expect(result.available).toBe(true);
    expect(result.archives.length).toBeGreaterThan(0);
    expect(result.archives[0].valid).toBe(true);
    expect(result.archives[0].fileCount).toBeGreaterThan(0);
  });

  it("inspects an intact archive", () => {
    const { archiveRoot } = makeArchive();
    const id = new SessionArchiveStore({ archiveRoot }).list().archives[0].id;
    const inspect = new SessionArchiveStore({ archiveRoot }).inspect(id);
    expect(inspect.available).toBe(true);
    expect(inspect.intact).toBe(true);
    expect(inspect.missing).toHaveLength(0);
    expect(inspect.corrupt).toHaveLength(0);
  });

  it("flags corruption when an archived file changes", () => {
    const { archiveRoot } = makeArchive();
    const store = new SessionArchiveStore({ archiveRoot });
    const summary = store.list().archives[0];
    const file = store.inspect(summary.id).files[0];
    fs.writeFileSync(path.join(summary.archiveDir, file.target), "tampered");
    const inspect = store.inspect(summary.id);
    expect(inspect.intact).toBe(false);
    expect(inspect.corrupt.length).toBeGreaterThan(0);
  });

  it("reports archive not found on inspect", () => {
    const { archiveRoot } = makeArchive();
    const inspect = new SessionArchiveStore({ archiveRoot }).inspect("does-not-exist");
    expect(inspect.available).toBe(false);
    expect(inspect.reason).toMatch(/not found/);
  });
});
