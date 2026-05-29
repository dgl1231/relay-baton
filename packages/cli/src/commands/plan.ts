import * as fs from "fs";
import {
  ConfigLoader, SessionManager, BatonWorkflow, GitService,
  PlanQualityGate, PromptBuilder, runAgent, planTemplate,
  backupPlan, diffPlans,
} from "@relay-baton/core";
import type { AgentId, DietProfileName } from "@relay-baton/shared";
import { ProjectOpts, resolveProjectContext } from "./projectOptions";
import { adapterFor } from "./agentFor";
import { executeCommand } from "./execute";

export interface PlanOpts extends ProjectOpts {
  diet?: string;
  with?: string;
  planner?: string;
  executor?: string;
  force?: boolean;
  run?: boolean;
  noRun?: boolean;
  thenExecute?: boolean;
  allowApiKeyEnv?: boolean;
}

export async function planCommand(task: string, opts: PlanOpts) {
  const projectContext = resolveProjectContext(opts, true);
  const repoRoot = projectContext.repoRoot;
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  if (!sm.getMeta()) sm.init(task);
  sm.writeTask(task);

  const git = new GitService(repoRoot);
  if (!git.isGitRepo()) {
    console.error("[relay-baton] not a git repository. aborting.");
    process.exit(2);
  }

  const profileName = (opts.diet ?? projectContext.project?.defaultDiet ?? config.tokenDiet.profile) as DietProfileName;
  if (!config.tokenDiet.profiles[profileName]) {
    console.error(`unknown diet profile: ${profileName}`);
    process.exit(2);
  }

  const planner = (opts.planner ?? opts.with ?? config.planExecute?.defaultPlanner ?? "claude") as AgentId;

  // Refresh artifacts so the planner can read repo-map / compact-state by reference.
  new BatonWorkflow(sm, config).refreshArtifacts(profileName);

  sm.updateMeta({
    task,
    workflowMode: "plan-execute",
    status: "planning",
    planAuthor: planner,
    activeAgent: planner,
    tokenDietProfile: profileName,
  });

  // --no-run: scaffold an empty plan template for manual authoring, then stop.
  if (opts.run === false || opts.noRun) {
    if (!fs.existsSync(sm.files.p("plan"))) {
      fs.writeFileSync(sm.files.p("plan"), planTemplate(task), "utf8");
      console.log(`[relay-baton] wrote plan template: ${sm.files.p("plan")}`);
      console.log("[relay-baton] fill it in, then run 'relay-baton execute'.");
    } else {
      console.log("[relay-baton] plan.md already exists; left untouched (--no-run).");
    }
    sm.updateMeta({ status: "plan_ready", activeAgent: "none" });
    return;
  }

  // Plan diffing (v0.7): back up the existing plan so we can report a
  // deterministic section-level delta after the planner rewrites it.
  const prevPlan = fs.existsSync(sm.files.p("plan")) ? fs.readFileSync(sm.files.p("plan"), "utf8") : "";
  const backupPath = backupPlan(repoRoot);
  if (backupPath) console.log(`[relay-baton] backed up previous plan: ${backupPath}`);

  // Launch the planner agent with the planner prompt.
  const adapter = adapterFor(planner, config);
  const prompt = PromptBuilder.planner(task);
  const cmd = adapter.buildCommand({ task: prompt, prompt, repoRoot, sessionDir: sm.files.dir, dietProfile: profileName });
  console.log(`[relay-baton] planning with ${cmd.command} (${planner}) ...`);
  const r = await runAgent({
    command: cmd,
    logFile: sm.files.p("commandsLog"),
    authPolicy: config.authPolicy,
    allowApiKeyEnv: opts.allowApiKeyEnv,
    onStdout: l => process.stdout.write(l + "\n"),
    onStderr: l => process.stderr.write(l + "\n"),
  });
  if (r.error) {
    console.error(r.error);
    sm.updateMeta({ status: "failed", lastError: r.error, lastAgent: planner, activeAgent: "none" });
    process.exit(1);
  }

  // Validate the plan the planner wrote.
  const gate = new PlanQualityGate(repoRoot, config.tokenDiet.profiles[profileName]).check();
  if (!gate.ok) {
    console.error("[relay-baton] Plan Quality Gate failed:");
    for (const f of gate.failures) console.error("  - " + f);
    if (!opts.force) {
      sm.updateMeta({ status: "failed", lastAgent: planner, activeAgent: "none", lastError: "plan quality gate failed" });
      console.error("[relay-baton] aborting. Fix plan.md or use --force.");
      process.exit(3);
    }
  }
  for (const w of gate.warnings) console.error("[relay-baton] warn: " + w);

  sm.updateMeta({
    status: "plan_ready",
    lastAgent: planner,
    activeAgent: "none",
    planFinalizedAt: new Date().toISOString(),
    lastError: null,
  });
  console.log(`[relay-baton] plan ready: ${sm.files.p("plan")}`);

  // Report the section-level delta vs the previous plan, if there was one.
  if (prevPlan.trim()) {
    const newPlan = fs.readFileSync(sm.files.p("plan"), "utf8");
    const delta = diffPlans(prevPlan, newPlan);
    if (delta.changed) {
      console.log("[relay-baton] plan delta vs previous:");
      for (const s of delta.sections) {
        if (s.change !== "unchanged") console.log(`  - ${s.section}: ${s.change}`);
      }
    } else {
      console.log("[relay-baton] plan unchanged vs previous.");
    }
  }

  if (opts.thenExecute) {
    console.log("[relay-baton] --then-execute: starting execute phase...");
    await executeCommand({
      diet: opts.diet,
      with: opts.executor,
      force: opts.force,
      allowApiKeyEnv: opts.allowApiKeyEnv,
      project: opts.project,
      path: opts.path,
    });
  } else {
    console.log("[relay-baton] run 'relay-baton execute' to implement it.");
  }
}
