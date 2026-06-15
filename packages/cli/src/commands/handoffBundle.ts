import { HandoffBundler, HandoffBundleInspector } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface HandoffBundleOpts extends ProjectOpts {
  json?: boolean;
  dryRun?: boolean;
  out?: string;
}

export async function handoffBundleCommand(opts: HandoffBundleOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const result = new HandoffBundler(repoRoot).bundle({ bundleRoot: opts.out, dryRun: opts.dryRun });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.available) {
    console.log(`[relay-baton] handoff bundle unavailable: ${result.reason}`);
    return;
  }

  const count = result.manifest?.files.length ?? 0;
  const prefix = result.dryRun ? "would bundle" : "bundled";
  console.log(`[relay-baton] ${prefix} ${count} artifact(s)`);
  console.log(`bundle: ${result.bundleDir}`);
  const r = result.redaction;
  if (r && !r.clean) {
    console.log(`⚠ redaction: ${r.findings.length} finding(s) — review before sharing`);
    for (const f of r.findings.slice(0, 10)) {
      console.log(`  - [${f.severity}] ${f.category}: ${f.file}${f.line ? ":" + f.line : ""} (${f.hint})`);
    }
  } else if (r) {
    console.log("redaction: clean");
  }
  if (!result.dryRun) console.log("manifest: manifest.json");
}

export interface HandoffInspectOpts {
  json?: boolean;
  out?: string;
}

export async function handoffInspectCommand(bundle: string, opts: HandoffInspectOpts = {}) {
  const result = new HandoffBundleInspector({ bundleRoot: opts.out }).inspect(bundle);

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.available) {
    console.log(`[relay-baton] cannot inspect bundle: ${result.reason}`);
    return;
  }

  console.log(`[relay-baton] handoff bundle ${result.id}`);
  console.log(`repoRoot: ${result.repoRoot ?? "unknown"}`);
  console.log(`createdAt: ${result.createdAt ?? "unknown"}`);
  console.log(`git: ${result.git?.branch ?? "(no git)"}${result.git ? ` · ${result.git.changed} changed` : ""}`);
  console.log(`files: ${result.fileCount}, total ${result.totalBytes} bytes`);
  console.log(`integrity: ${result.intact ? "intact" : "DAMAGED"}`);
  if (result.missing.length) console.log(`missing: ${result.missing.join(", ")}`);
  if (result.corrupt.length) console.log(`corrupt: ${result.corrupt.join(", ")}`);
  if (result.redactionFindings != null) console.log(`redaction findings recorded: ${result.redactionFindings}`);
}
