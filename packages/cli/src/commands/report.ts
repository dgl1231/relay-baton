import * as fs from "fs";
import { ConfigLoader, HandoffReport } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface ReportOpts extends ProjectOpts {
  out?: string;
  json?: boolean;
}

export async function reportCommand(opts: ReportOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const { config } = ConfigLoader.load(repoRoot);
  const markdown = new HandoffReport(repoRoot, config).generate();

  if (opts.out) {
    fs.writeFileSync(opts.out, markdown, "utf8");
    console.log(`[relay-baton] report written to ${opts.out}`);
    return;
  }
  if (opts.json) {
    console.log(JSON.stringify({ markdown }, null, 2));
    return;
  }
  console.log(markdown);
}
