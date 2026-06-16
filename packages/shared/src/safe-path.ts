import * as fs from "fs";
import * as path from "path";

/**
 * v2.2 — untrusted-bundle / path-traversal safety.
 *
 * Externally-received bundles and archives carry a manifest whose `target`
 * paths we must NOT trust. A malicious manifest could point a `target` at an
 * absolute path (`/etc/passwd`, `C:\Windows\...`), escape the bundle root with
 * `..`, or route through a symlink that resolves outside the root. Resolving
 * such a target and reading it would turn `inspect` into an arbitrary-file-read
 * (and SHA-256 oracle) primitive.
 *
 * `resolveWithin` is the single chokepoint: it rejects absolute targets, `..`
 * escapes, and symlinked escapes, returning a path that is provably inside
 * `root`. Anything suspicious returns `null` — callers treat that as "unsafe"
 * rather than reading the file.
 */

/**
 * Per-file size cap applied when an inspector reads an untrusted file to verify
 * it (8 MiB). Curated handoff/session artifacts are small; a manifest claiming
 * a huge file is a red flag and would also let a hostile bundle exhaust memory
 * during verification.
 */
export const MAX_INSPECT_FILE_BYTES = 8 * 1024 * 1024;

export type UnsafeReason = "absolute" | "escapes-root" | "symlink-escape";

export interface ResolveWithinResult {
  /** Absolute path inside `root`, or null when the target is unsafe. */
  abs: string | null;
  /** POSIX-style relative path from root (for display), even when unsafe. */
  rel: string;
  reason?: UnsafeReason;
}

/**
 * Resolve a manifest `target` against `root`, refusing anything that would
 * escape `root`. `root` is assumed trusted (it is where we put the bundle).
 *
 * Rejects, in order:
 *  - absolute `target` (`/x`, `C:\x`, `\\server\share`)
 *  - normalized path that escapes `root` via `..`
 *  - a path whose existing prefix is a symlink pointing outside `root`
 */
export function resolveWithin(root: string, target: string): ResolveWithinResult {
  const relForDisplay = toPosix(target);

  if (path.isAbsolute(target) || /^[a-zA-Z]:[\\/]/.test(target) || /^\\\\/.test(target)) {
    return { abs: null, rel: relForDisplay, reason: "absolute" };
  }

  const rootResolved = path.resolve(root);
  const candidate = path.resolve(rootResolved, target);
  const rel = path.relative(rootResolved, candidate);
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    return { abs: null, rel: relForDisplay, reason: "escapes-root" };
  }

  // Symlink escape: walk the existing prefix and ensure realpath stays inside.
  if (escapesViaSymlink(rootResolved, candidate)) {
    return { abs: null, rel: relForDisplay, reason: "symlink-escape" };
  }

  return { abs: candidate, rel: toPosix(rel) };
}

function escapesViaSymlink(rootResolved: string, candidate: string): boolean {
  let realRoot: string;
  try {
    realRoot = fs.realpathSync(rootResolved);
  } catch {
    // Root itself missing — nothing to verify against; treat as in-root.
    return false;
  }

  // Find the deepest existing ancestor of `candidate` and realpath it.
  let existing = candidate;
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) return false; // reached filesystem root
    existing = parent;
  }

  let realExisting: string;
  try {
    realExisting = fs.realpathSync(existing);
  } catch {
    return false;
  }

  const rel = path.relative(realRoot, realExisting);
  return rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/").replace(/\\/g, "/");
}
