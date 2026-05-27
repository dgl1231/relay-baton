import { ConfigLoader, SessionManager, BatonWorkflow } from "@relay-baton/core";
import type { DietProfileName } from "@relay-baton/shared";
import { ProjectOpts, resolveProjectContext } from "./projectOptions";

export async function compactCommand(opts: { diet?: string } & ProjectOpts) {
  const projectContext = resolveProjectContext(opts);
  const repoRoot = projectContext.repoRoot;
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  if (!sm.getMeta()) sm.init("");
  const profileName = (opts.diet ?? projectContext.project?.defaultDiet ?? config.tokenDiet.profile) as DietProfileName;
  if (!config.tokenDiet.profiles[profileName]) {
    console.error(`unknown diet profile: ${profileName}`);
    process.exit(2);
  }
  const wf = new BatonWorkflow(sm, config);
  wf.refreshArtifacts(profileName);
  sm.updateMeta({ tokenDietProfile: profileName });
  console.log(`[relay-baton] compacted session with profile=${profileName}`);
}
