import { ConfigLoader, SessionManager } from "@relay-baton/core";

export async function initCommand() {
  const repoRoot = process.cwd();
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  const r = sm.init("");
  if (r.alreadyExisted && r.createdFiles.length === 0) {
    console.log(`[relay-baton] .ai-session already exists at ${r.dir}. Nothing to do.`);
  } else {
    console.log(`[relay-baton] initialized ${r.dir}`);
    for (const f of r.createdFiles) console.log(`  + ${f}`);
  }
}
