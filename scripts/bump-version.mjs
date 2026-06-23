#!/usr/bin/env node
// Synchronize the project version across every place that hard-codes it.
// Usage: node scripts/bump-version.mjs 1.1.0   (bare semver, no leading "v")
//
// Build-critical (npm packages + CLI --version + desktop installers) are always
// rewritten. In-repo package-manager manifests (homebrew/scoop/winget) get their
// version + download URL bumped here; their SHA-256 hashes are refreshed by the
// release workflow once the real binaries exist, so they may lag until a tag.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Usage: node scripts/bump-version.mjs <semver>\n  got: ${version ?? "(nothing)"}`);
  process.exit(1);
}

const touched = [];
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const write = (p, s) => { fs.writeFileSync(path.join(root, p), s); touched.push(p); };

// --- JSON files: set top-level "version" (and packages."" for lockfiles) ---
function bumpJson(rel, { lockRoot = false } = {}) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return;
  const json = JSON.parse(fs.readFileSync(p, "utf8"));
  json.version = version;
  if (lockRoot && json.packages && json.packages[""]) json.packages[""].version = version;
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + "\n");
  touched.push(rel);
}

bumpJson("package.json");
for (const pkg of ["cli", "core", "shared", "tui"]) bumpJson(`packages/${pkg}/package.json`);
bumpJson("desktop/package.json");
bumpJson("desktop/package-lock.json", { lockRoot: true });
bumpJson("desktop/src-tauri/tauri.conf.json");

// --- CLI --version string ---
{
  const rel = "packages/cli/src/index.ts";
  const s = read(rel).replace(/\.version\("[^"]+"\)/, `.version("${version}")`);
  write(rel, s);
}

// --- Cargo.toml: first `version = "..."` (the [package] one) ---
{
  const rel = "desktop/src-tauri/Cargo.toml";
  const s = read(rel).replace(/^version = "[^"]+"/m, `version = "${version}"`);
  write(rel, s);
}

// --- Homebrew formula: version + download URLs ---
{
  const rel = "homebrew/relay-baton.rb";
  let s = read(rel)
    .replace(/version "[^"]+"/, `version "${version}"`)
    .replace(/releases\/download\/v[^/]+\//g, `releases/download/v${version}/`);
  write(rel, s);
}

// --- Scoop manifest: version + url ---
{
  const rel = "scoop/relay-baton.json";
  const json = JSON.parse(read(rel));
  json.version = version;
  json.architecture["64bit"].url = json.architecture["64bit"].url.replace(/download\/v[^/]+\//, `download/v${version}/`);
  write(rel, JSON.stringify(json, null, 2) + "\n");
}

// --- Winget manifests: PackageVersion + installer URL ---
for (const rel of [
  "winget/dgl1231.relay-baton.yaml",
  "winget/dgl1231.relay-baton.installer.yaml",
  "winget/dgl1231.relay-baton.locale.en-US.yaml",
]) {
  if (!fs.existsSync(path.join(root, rel))) continue;
  let s = read(rel).replace(/PackageVersion: .+/g, `PackageVersion: ${version}`);
  s = s.replace(/releases\/download\/v[^/]+\//g, `releases/download/v${version}/`);
  write(rel, s);
}

console.log(`Bumped to ${version}:`);
for (const p of touched) console.log(`  - ${p}`);
console.log(`\nNext: review the diff, commit, then \`git tag v${version} && git push origin v${version}\`.`);
console.log(`Note: package-manager SHA-256 hashes are refreshed by the release workflow.`);
