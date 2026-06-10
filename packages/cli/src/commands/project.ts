import * as fs from "fs";
import * as path from "path";
import { GitService, ProjectManager } from "@relay-baton/core";
import type { AgentId, DietProfileName } from "@relay-baton/shared";

interface AddOpts {
  name?: string;
  diet?: DietProfileName;
  primary?: AgentId;
  fallback?: AgentId;
}

const diets = new Set(["off", "lite", "balanced", "caveman", "ultra"]);
const agents = new Set(["codex", "claude", "opencode", "gemini", "aider"]);

function assertDiet(value?: string): DietProfileName | undefined {
  if (!value) return undefined;
  if (!diets.has(value)) {
    console.error(`unknown diet profile: ${value}`);
    process.exit(2);
  }
  return value as DietProfileName;
}

function assertAgent(value?: string, label = "agent"): AgentId | undefined {
  if (!value) return undefined;
  if (!agents.has(value)) {
    console.error(`unknown ${label}: ${value}`);
    process.exit(2);
  }
  return value as AgentId;
}

export async function projectAddCommand(projectPath: string, opts: AddOpts) {
  const resolved = path.resolve(projectPath);
  if (!fs.existsSync(resolved)) {
    console.error(`[relay-baton] path does not exist: ${resolved}`);
    process.exit(2);
  }
  if (!new GitService(resolved).isGitRepo()) {
    console.error(`[relay-baton] not a git repository: ${resolved}`);
    process.exit(2);
  }

  const manager = new ProjectManager();
  const result = manager.addProject({
    path: resolved,
    name: opts.name,
    defaultDiet: assertDiet(opts.diet),
    primaryAgent: assertAgent(opts.primary, "primary agent"),
    fallbackAgent: assertAgent(opts.fallback, "fallback agent"),
  });

  if (!result.added) {
    console.log("[relay-baton] project already registered:");
    printProject(result.project, true);
    return;
  }
  console.log("[relay-baton] project added:");
  printProject(result.project, true);
}

export interface JsonOpts {
  json?: boolean;
}

export async function projectListCommand(opts: JsonOpts = {}) {
  const manager = new ProjectManager();
  const data = manager.getRegistry();
  if (opts.json) {
    console.log(JSON.stringify({
      activeProjectId: data.activeProjectId ?? null,
      projects: data.projects,
    }, null, 2));
    return;
  }
  if (data.projects.length === 0) {
    console.log("[relay-baton] no registered projects.");
    return;
  }
  for (const p of data.projects) printProject(p, data.activeProjectId === p.id);
}

export async function projectSwitchCommand(nameOrId: string) {
  const project = new ProjectManager().switchProject(nameOrId);
  if (!project) {
    console.error(`[relay-baton] project not found: ${nameOrId}`);
    process.exit(2);
  }
  console.log(`[relay-baton] active project: ${project.name} (${project.path})`);
}

export async function projectCurrentCommand(opts: JsonOpts = {}) {
  const active = new ProjectManager().getActiveProject();
  if (opts.json) {
    console.log(JSON.stringify({ active: active ?? null, cwd: process.cwd() }, null, 2));
    return;
  }
  if (!active) {
    console.log(`[relay-baton] no active project. Using cwd: ${process.cwd()}`);
    return;
  }
  printProject(active, true);
}

export async function projectRemoveCommand(nameOrId: string) {
  const removed = new ProjectManager().removeProject(nameOrId);
  if (!removed) {
    console.error(`[relay-baton] project not found: ${nameOrId}`);
    process.exit(2);
  }
  console.log(`[relay-baton] project removed: ${removed.name}`);
}

export async function projectDoctorCommand() {
  const manager = new ProjectManager();
  const data = manager.getRegistry();
  if (data.projects.length === 0) {
    console.log("[relay-baton] no registered projects.");
    return;
  }
  for (const p of data.projects) {
    const exists = fs.existsSync(p.path);
    console.log(`${data.activeProjectId === p.id ? "*" : " "} ${p.name} (${p.id})`);
    console.log(`  path: ${p.path}`);
    console.log(`  exists: ${exists ? "yes" : "no"}`);
    console.log(`  git repo: ${exists && new GitService(p.path).isGitRepo() ? "yes" : "no"}`);
    console.log(`  .ai-session: ${fs.existsSync(path.join(p.path, ".ai-session")) ? "yes" : "no"}`);
    console.log(`  AGENTS.md: ${fs.existsSync(path.join(p.path, "AGENTS.md")) ? "yes" : "no"}`);
    console.log(`  CLAUDE.md: ${fs.existsSync(path.join(p.path, "CLAUDE.md")) ? "yes" : "no"}`);
  }
}

function printProject(project: any, active: boolean) {
  const marker = active ? "*" : " ";
  console.log(`${marker} ${project.name} (${project.id})`);
  console.log(`  path: ${project.path}`);
  console.log(`  defaultDiet: ${project.defaultDiet ?? "-"}`);
  console.log(`  agents: ${project.primaryAgent ?? "-"} -> ${project.fallbackAgent ?? "-"}`);
  console.log(`  lastUsedAt: ${project.lastUsedAt ?? "-"}`);
}
