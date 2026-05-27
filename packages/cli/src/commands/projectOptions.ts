import { ProjectResolver, ProjectResolveResult } from "@relay-baton/core";

export interface ProjectOpts {
  project?: string;
  path?: string;
}

export function resolveRepoRoot(opts: ProjectOpts = {}): string {
  return resolveProjectContext(opts).repoRoot;
}

export function resolveProjectContext(opts: ProjectOpts = {}, touch = false): ProjectResolveResult {
  try {
    const resolver = new ProjectResolver();
    const result = resolver.resolve(opts);
    if (touch) resolver.touch(result);
    return result;
  } catch (e: any) {
    console.error(`[relay-baton] ${e?.message ?? e}`);
    process.exit(2);
  }
}
