// v2.2 supply-chain hardening — diff this release's CycloneDX SBOM against the
// previous release's SBOM to flag dependency drift. Advisory only: any failure
// (no previous SBOM, malformed JSON, gh error) is logged and exits 0 so it can
// never block a release. Writes release-assets/sbom-diff.md when a comparison is
// possible, and always appends a short summary to the GitHub step summary.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = "release-assets";
const tag = process.env.TAG;
const repository = process.env.REPOSITORY;
const SBOM = "relay-baton.cdx.json";

function bail(msg) {
  console.log(`[sbom-diff] ${msg}`);
  process.exit(0);
}

if (!tag || !repository) bail("TAG or REPOSITORY not set; skipping.");
const currentPath = path.join(root, SBOM);
if (!existsSync(currentPath)) bail("current SBOM not found; skipping (SBOM generation may have failed).");

/** Map a CycloneDX doc to { "name": "version" } over its components. */
function componentsOf(doc) {
  const out = new Map();
  for (const c of doc?.components ?? []) {
    if (!c?.name) continue;
    const key = c.group ? `${c.group}/${c.name}` : c.name;
    out.set(key, c.version ?? "(no version)");
  }
  return out;
}

let current;
try {
  current = componentsOf(JSON.parse(readFileSync(currentPath, "utf8")));
} catch (err) {
  bail(`could not parse current SBOM: ${err.message}`);
}

// Find the previous release tag (the newest release that isn't this tag).
let prevTag = null;
try {
  const json = execFileSync(
    "gh",
    ["release", "list", "--repo", repository, "--limit", "30", "--json", "tagName,createdAt"],
    { encoding: "utf8" },
  );
  const releases = JSON.parse(json)
    .filter((r) => r.tagName !== tag)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  prevTag = releases[0]?.tagName ?? null;
} catch (err) {
  bail(`could not list releases: ${err.message}`);
}
if (!prevTag) bail("no previous release to diff against (first release?).");

// Download the previous SBOM.
const dir = mkdtempSync(path.join(tmpdir(), "rb-sbom-"));
let previous;
try {
  execFileSync("gh", ["release", "download", prevTag, "--repo", repository, "--pattern", SBOM, "--dir", dir], {
    stdio: "pipe",
  });
  previous = componentsOf(JSON.parse(readFileSync(path.join(dir, SBOM), "utf8")));
} catch (err) {
  bail(`previous release ${prevTag} has no comparable SBOM: ${err.message}`);
}

const added = [];
const removed = [];
const changed = [];
for (const [name, version] of current) {
  if (!previous.has(name)) added.push(`${name}@${version}`);
  else if (previous.get(name) !== version) changed.push(`${name}: ${previous.get(name)} → ${version}`);
}
for (const [name, version] of previous) {
  if (!current.has(name)) removed.push(`${name}@${version}`);
}
added.sort();
removed.sort();
changed.sort();

const section = (title, items) =>
  items.length ? `### ${title} (${items.length})\n\n${items.map((i) => `- ${i}`).join("\n")}\n` : `### ${title} (0)\n\n_none_\n`;

const noChanges = !added.length && !removed.length && !changed.length;
const md =
  `# SBOM diff: ${prevTag} → ${tag}\n\n` +
  (noChanges ? "No dependency changes detected.\n\n" : "") +
  `${section("Added", added)}\n${section("Removed", removed)}\n${section("Changed", changed)}\n`;

writeFileSync(path.join(root, "sbom-diff.md"), md);
console.log(`[sbom-diff] wrote sbom-diff.md (+${added.length} -${removed.length} ~${changed.length} vs ${prevTag})`);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}
