import { ConfigLoader, ProjectProfile } from "@relay-baton/core";
import { ProjectOpts, resolveProjectContext } from "./projectOptions";

export interface ProfileOpts extends ProjectOpts {
  json?: boolean;
}

export async function profileCommand(opts: ProfileOpts = {}) {
  const ctx = resolveProjectContext(opts);
  const { config } = ConfigLoader.load(ctx.repoRoot);
  const profile = new ProjectProfile(ctx.repoRoot, config, ctx.project).generate();

  if (opts.json) {
    console.log(JSON.stringify(profile, null, 2));
    return;
  }

  console.log(`[relay-baton] project profile: ${profile.repoRoot}`);
  console.log(`tags: ${profile.tags.join(", ") || "-"}`);
  console.log(`frameworks: ${profile.frameworks.join(", ") || "-"}`);
  console.log(`monorepo: ${profile.monorepo ? `yes (${profile.packageCount})` : "no"}`);
  const r = profile.recommended;
  console.log(`recommended build: ${r.build ?? "-"}`);
  console.log(`recommended test: ${r.test ?? "-"}`);
  console.log(`diet: ${r.diet} · agents: ${r.primaryAgent} -> ${r.fallbackAgent}`);
  console.log(`entry points: ${profile.entryPoints.join(", ") || "-"}`);
}
