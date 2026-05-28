import { ConfigLoader, SessionManager, ContextCompressor } from "@relay-baton/core";
import type { DietProfileName } from "@relay-baton/shared";
import { ProjectOpts, resolveProjectContext } from "./projectOptions";

export interface CompressContextOpts extends ProjectOpts {
  diet?: string;
  threshold?: string;
  dryRun?: boolean;
  force?: boolean;
}

export async function compressContextCommand(opts: CompressContextOpts) {
  const projectContext = resolveProjectContext(opts);
  const repoRoot = projectContext.repoRoot;
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  if (!sm.getMeta()) {
    console.log("[relay-baton] no session. Run `relay-baton init`.");
    return;
  }
  const meta = sm.getMeta()!;
  const profileName = (opts.diet ?? meta.tokenDietProfile ?? projectContext.project?.defaultDiet ?? config.tokenDiet.profile) as DietProfileName;
  const profile = config.tokenDiet.profiles[profileName];
  if (!profile) {
    console.error(`unknown diet profile: ${profileName}`);
    process.exit(2);
  }

  const threshold = opts.threshold != null ? Number(opts.threshold) : undefined;
  if (threshold != null && (Number.isNaN(threshold) || threshold < 0 || threshold > 1)) {
    console.error(`--threshold must be between 0 and 1 (got ${opts.threshold})`);
    process.exit(2);
  }

  const compressor = new ContextCompressor(repoRoot, config);
  const before = compressor.weigh(profile);
  console.log(`[relay-baton] context weight: ${before.total}/${before.budget} chars (ratio ${before.ratio.toFixed(2)})`);

  const result = compressor.compressIfNeeded(profile, { force: opts.force, threshold, dryRun: opts.dryRun });

  if (opts.dryRun) {
    console.log(`[relay-baton] dry-run: ${result.reason}`);
    return;
  }
  if (!result.compressed) {
    if (result.rolledBack) {
      console.error("[relay-baton] compression rolled back (gate failed):");
      for (const f of result.gateFailures ?? []) console.error("  - " + f);
      process.exit(3);
    }
    console.log(`[relay-baton] skipped: ${result.reason}`);
    return;
  }
  sm.updateMeta({ status: "compressing" });
  console.log(`[relay-baton] compressed: ${result.before.total} -> ${result.after?.total} chars`);
  if (result.rotatedLog) console.log(`[relay-baton] raw log rotated to ${result.rotatedLog}`);
  // Compression is a transient phase; leave the prior status semantics intact.
  sm.updateMeta({ status: meta.status });
}
