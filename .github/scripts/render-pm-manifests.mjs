#!/usr/bin/env node
// Render the Homebrew formula + Scoop manifest for a release, using the real
// SHA-256 hashes from the release SHA256SUMS file. Used by the release workflow
// to push updates to the tap / bucket repos. Deterministic, no network.
//
// Usage: node render-pm-manifests.mjs <SHA256SUMS> <out-dir>
//   env VERSION = bare semver (e.g. 1.1.0)
//   reads templates from repo: homebrew/relay-baton.rb, scoop/relay-baton.json
//   writes: <out-dir>/Formula/relay-baton.rb, <out-dir>/bucket/relay-baton.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const [sumsPath, outDir] = process.argv.slice(2);
const version = process.env.VERSION;
if (!sumsPath || !outDir || !version) {
  console.error("Usage: VERSION=x node render-pm-manifests.mjs <SHA256SUMS> <out-dir>");
  process.exit(1);
}

// Parse "  <hash>  <filename>" lines into { filename: hash }.
const hashes = {};
for (const line of fs.readFileSync(sumsPath, "utf8").split(/\r?\n/)) {
  const m = /^([0-9a-fA-F]{64})\s+\*?(.+)$/.exec(line.trim());
  if (m) hashes[m[2]] = m[1].toLowerCase();
}
const need = (f) => {
  if (!hashes[f]) { console.error(`missing hash for ${f} in ${sumsPath}`); process.exit(1); }
  return hashes[f];
};

// --- Homebrew formula ---
let rb = fs.readFileSync(path.join(repo, "homebrew/relay-baton.rb"), "utf8")
  .replace(/version "[^"]+"/, `version "${version}"`)
  .replace(/releases\/download\/v[^/]+\//g, `releases/download/v${version}/`)
  .replace(
    /(url "[^"]*relay-baton-(macos-arm64|linux-x64)"\n\s*sha256 ")[^"]+(")/g,
    (_, pre, name, post) => pre + need(`relay-baton-${name}`) + post,
  );
fs.mkdirSync(path.join(outDir, "Formula"), { recursive: true });
fs.writeFileSync(path.join(outDir, "Formula/relay-baton.rb"), rb);

// --- Scoop manifest ---
const scoop = JSON.parse(fs.readFileSync(path.join(repo, "scoop/relay-baton.json"), "utf8"));
scoop.version = version;
scoop.architecture["64bit"].url = scoop.architecture["64bit"].url.replace(/download\/v[^/]+\//, `download/v${version}/`);
scoop.architecture["64bit"].hash = need("relay-baton-windows-x64.exe");
fs.mkdirSync(path.join(outDir, "bucket"), { recursive: true });
fs.writeFileSync(path.join(outDir, "bucket/relay-baton.json"), JSON.stringify(scoop, null, 2) + "\n");

console.log(`Rendered Homebrew + Scoop manifests for v${version} into ${outDir}`);
