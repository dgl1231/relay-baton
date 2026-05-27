import { ProjectResolver, ProjectResolveResult } from "@relay-baton/core";

export interface ProjectOpts {
  project?: string;
  path?: string;
}

export function resolveRepoRoot(opts: ProjectOpts = {}): string {
  return resolveProjectContext(opts).repoRoot;
}

export function resolveProjectContext(opts: ProjectOpts = {}): ProjectResolveResult {
  try {
    return new ProjectResolver().resolve(opts);
  } catch (e: any) {
    console.error(`[relay-baton] ${e?.message ?? e}`);
    process.exit(2);
  }
}
