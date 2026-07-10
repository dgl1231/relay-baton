import { ConfigLoader, WorkspaceManager, suggestChain, AGENT_REGISTRY } from "@relay-baton/core";
import * as fs from "fs";
import type { AgentId } from "@relay-baton/shared";
import { ProjectOpts, resolveProjectContext } from "./projectOptions";
import { resolveChain, RunOpts } from "./run";
import { ui, color } from "../ui";

export interface RouteOpts extends ProjectOpts {
  json?: boolean;
  primary?: string;
  fallback?: string;
  chain?: string;
}

/**
 * v2.8 — `relay-baton route "<task>"`: read-only preview of the advisory
 * routing hint. Resolves the relay chain exactly like `run` (flags > work-item
 * assignment > project > config), then shows how the registry `strengths` tags
 * would reorder it for this task. Never launches an agent, never writes
 * session state; explicit --chain/--primary always define the actual chain.
 */
export function routeCommand(task: string, opts: RouteOpts) {
  const projectContext = resolveProjectContext(opts, false);
  const mainRoot = projectContext.repoRoot;
  const activeItem = new WorkspaceManager(mainRoot).activeSession();
  const repoRoot = activeItem?.worktree && fs.existsSync(activeItem.worktree) ? activeItem.worktree : mainRoot;
  const { config } = ConfigLoader.load(repoRoot);

  const chain = resolveChain(opts as RunOpts, projectContext.project, config, activeItem?.assignedAgent);
  const suggestion = suggestChain(task, chain);
  const strengths = Object.fromEntries(chain.map((id: AgentId) => [id, AGENT_REGISTRY[id]?.strengths ?? []]));

  if (opts.json) {
    console.log(JSON.stringify({
      task,
      resolvedChain: chain,
      suggestedChain: suggestion.chain,
      differs: suggestion.differs,
      matched: suggestion.matched,
      strengths,
      advisory: true,
    }, null, 2));
    return;
  }

  ui.info(`resolved chain: ${ui.chain(chain)}${opts.chain || opts.primary ? color.dim(" (explicit — hints would be suppressed in run)") : ""}`);
  if (!suggestion.differs) {
    ui.ok(`this order already fits the task — no reordering suggested.`);
  } else {
    const why = Object.entries(suggestion.matched).map(([id, tags]) => `${id}: ${(tags as string[]).join("/")}`).join("; ");
    ui.info(`suggested order: ${ui.chain(suggestion.chain)}${why ? color.dim(` — ${why}`) : ""}`);
    ui.hint(`advisory only — apply it with: relay-baton run "<task>" --chain ${suggestion.chain.join(",")}`);
  }
  const matchedAny = Object.keys(suggestion.matched).length > 0;
  if (!matchedAny) ui.hint(`no strength tags matched this task; agent tags: ${chain.map(id => `${id}(${(strengths as any)[id].join("/")})`).join(" · ")}`);
}
