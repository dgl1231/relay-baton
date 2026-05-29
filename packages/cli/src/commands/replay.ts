import { ConversationReplay } from "@relay-baton/core";
import type { ConversationEvent } from "@relay-baton/shared";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface ReplayOpts extends ProjectOpts {
  json?: boolean;
  session?: string;
  kind?: string;
  limit?: string;
}

export async function replayCommand(opts: ReplayOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const replay = new ConversationReplay(repoRoot);

  const kinds = opts.kind
    ? (opts.kind.split(",").map((k) => k.trim()).filter(Boolean) as ConversationEvent["kind"][])
    : undefined;
  const limit = opts.limit !== undefined ? Number(opts.limit) : undefined;

  const result = replay.build({
    sessionId: opts.session,
    kinds,
    limit: limit !== undefined && Number.isFinite(limit) ? limit : undefined,
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.entries.length === 0) {
    console.log("[relay-baton] no conversation events. (nothing recorded yet)");
    return;
  }
  for (const line of replay.renderLines({
    sessionId: opts.session,
    kinds,
    limit: limit !== undefined && Number.isFinite(limit) ? limit : undefined,
  })) {
    console.log(line);
  }
  const s = result.summary;
  console.log(`\n${s.total} events; roles ${JSON.stringify(s.byRole)}; kinds ${JSON.stringify(s.byKind)}`);
}
