// Stage a relay-baton CLI binary as a Tauri sidecar.
//
// Tauri's `externalBin` looks for `binaries/relay-baton-<target-triple>[.exe]`
// next to the host it bundles on. The Release workflow names its artifacts by
// OS label (relay-baton-linux-x64, ...-macos-arm64, ...-windows-x64.exe), so
// this script copies the right artifact into place under the triple name Tauri
// expects, and marks it executable on Unix.
//
// Pure Node (no bash/pwsh split) so it runs the same on Windows and CI.
//
// Usage:
//   node scripts/stage-sidecar.mjs [--from <path>] [--target <triple>]
//
//   --from    Path to the source CLI binary (the SEA single-file executable).
//             Default: search ../../dist-bin and ./dist-bin for the host asset.
//   --target  Override the Tauri target triple. Default: detect from host.

import { existsSync, mkdirSync, copyFileSync, chmodSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(here, "..");
const binariesDir = join(desktopRoot, "src-tauri", "binaries");

// host platform/arch -> { triple, exe, asset } (the Release artifact name)
const HOSTS = {
  "linux:x64": {
    triple: "x86_64-unknown-linux-gnu",
    exe: "",
    asset: "relay-baton-linux-x64",
  },
  "darwin:arm64": {
    triple: "aarch64-apple-darwin",
    exe: "",
    asset: "relay-baton-macos-arm64",
  },
  "darwin:x64": {
    triple: "x86_64-apple-darwin",
    exe: "",
    asset: "relay-baton-macos-x64",
  },
  "win32:x64": {
    triple: "x86_64-pc-windows-msvc",
    exe: ".exe",
    asset: "relay-baton-windows-x64.exe",
  },
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from") out.from = argv[++i];
    else if (a === "--target") out.target = argv[++i];
    else {
      console.error(`stage-sidecar: unknown argument "${a}"`);
      process.exit(2);
    }
  }
  return out;
}

function fail(msg) {
  console.error(`stage-sidecar: ${msg}`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const hostKey = `${process.platform}:${process.arch}`;
const host = HOSTS[hostKey];

if (!host && !(args.target && args.from)) {
  fail(
    `unsupported host "${hostKey}". Pass --target <triple> and --from <path> explicitly.`,
  );
}

const triple = args.target ?? host.triple;
// The .exe suffix depends on the TARGET triple, never the build host.
const exe = triple.includes("windows") ? ".exe" : "";

// Resolve the source binary.
let from = args.from;
if (!from) {
  const candidates = [
    join(desktopRoot, "..", "dist-bin", host.asset),
    join(process.cwd(), "dist-bin", host.asset),
  ];
  from = candidates.find((p) => existsSync(p));
  if (!from) {
    fail(
      `no --from given and none of these exist:\n  ${candidates.join("\n  ")}\n` +
        `Build the SEA binary first (see .github/workflows/release.yml) or pass --from.`,
    );
  }
}
from = resolve(from);
if (!existsSync(from)) fail(`source binary not found: ${from}`);

const destName = `relay-baton-${triple}${exe}`;
const dest = join(binariesDir, destName);

mkdirSync(binariesDir, { recursive: true });
copyFileSync(from, dest);
if (!exe) chmodSync(dest, 0o755); // executable bit for Unix sidecars

console.log(`staged sidecar:\n  ${from}\n  -> ${dest}`);
