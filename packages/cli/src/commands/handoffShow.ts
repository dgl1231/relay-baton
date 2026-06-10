import * as fs from "fs";
import { SessionFiles } from "@relay-baton/core";
import { SESSION_DIR } from "@relay-baton/shared";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";
import { collectHandoffHistory } from "./handoffHistory";

export interface HandoffShowOpts extends ProjectOpts {
  json?: boolean;
  /** Show a specific history file (name from `handoff history`) instead of the current handoff.md. */
  file?: string;
}

/**
 * Read-only view of a handoff document. This exists so display surfaces
 * (desktop webview, scripts) can render the handoff through the CLI instead
 * of reaching into `.ai-session/` themselves — the UI never touches files.
 */
export async function handoffShowCommand(opts: HandoffShowOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const files = new SessionFiles(repoRoot);

  let target = files.p("handoff");
  let name = "handoff.md";
  if (opts.file) {
    // Only allow names that `handoff history` itself lists — no path traversal.
    const entry = collectHandoffHistory(repoRoot).find((e) => e.name === opts.file);
    if (!entry) {
      console.error(`[relay-baton] unknown handoff file: ${opts.file} (see \`handoff history\`)`);
      process.exit(2);
    }
    target = entry.path;
    name = entry.name;
  }

  const exists = fs.existsSync(target);
  const content = exists ? fs.readFileSync(target, "utf8") : null;

  if (opts.json) {
    console.log(JSON.stringify({ name, path: target, exists, content }, null, 2));
    return;
  }
  if (!exists) {
    console.log(`[relay-baton] no handoff found at ${SESSION_DIR}/${name}`);
    return;
  }
  console.log(content);
}
