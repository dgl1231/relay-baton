import * as React from "react";
import { Box, Text, useApp, useInput } from "ink";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import {
  BatonWorkflow,
  ConfigLoader,
  ProjectManager,
  ProjectResolver,
  SessionManager,
} from "@relay-baton/core";
import type { BatonProject, DietProfileName } from "@relay-baton/shared";
import { Sidebar } from "./components/Sidebar";
import { SessionPanel } from "./components/SessionPanel";
import { ChangedFilesPanel } from "./components/ChangedFilesPanel";
import { BudgetPanel } from "./components/BudgetPanel";
import { LogTailPanel } from "./components/LogTailPanel";
import { StatusBar } from "./components/StatusBar";

export interface AppProps {
  project?: string;
  path?: string;
}

const diets: DietProfileName[] = ["off", "lite", "balanced", "caveman", "ultra"];

function readSafe(p: string, max = 4000): string {
  try {
    const s = fs.readFileSync(p, "utf8");
    return s.length > max ? "..." + s.slice(s.length - max) : s;
  } catch { return ""; }
}

function which(cmd: string): boolean {
  const r = spawnSync(cmd, ["--version"], { encoding: "utf8" });
  return r.error == null;
}

export function App(props: AppProps = {}) {
  const { exit } = useApp();
  const manager = React.useMemo(() => new ProjectManager(), []);
  const initial = React.useMemo(() => new ProjectResolver(manager).resolve(props), [manager, props.project, props.path]);
  const [repoRoot, setRepoRoot] = React.useState(initial.repoRoot);
  const [selectedDiet, setSelectedDiet] = React.useState<DietProfileName>("balanced");
  const [message, setMessage] = React.useState("");
  const [tick, setTick] = React.useState(0);

  const reload = React.useCallback(() => setTick(x => x + 1), []);

  useInput((input) => {
    if (input === "q" || input === "Q") exit();
    if (input === "r" || input === "R") reload();
    if (input === "b" || input === "B") {
      setMessage("budget reloaded");
      reload();
    }
    if (input === "d" || input === "D") {
      setSelectedDiet(current => diets[(diets.indexOf(current) + 1) % diets.length]);
    }
    if (input === "p" || input === "P") {
      const projects = manager.listProjects();
      if (projects.length === 0) {
        setMessage("no registered projects");
        return;
      }
      const active = manager.getActiveProject();
      const currentIndex = Math.max(0, projects.findIndex(p => p.id === active?.id));
      const next = projects[(currentIndex + 1) % projects.length];
      manager.switchProject(next.id);
      setRepoRoot(next.path);
      setSelectedDiet(next.defaultDiet ?? "balanced");
      setMessage(`active project: ${next.name}`);
      reload();
    }
    if (input === "h" || input === "H") {
      try {
        const { config } = ConfigLoader.load(repoRoot);
        const sm = new SessionManager(repoRoot, config);
        if (!sm.getMeta()) sm.init("");
        const meta = sm.getMeta();
        const wf = new BatonWorkflow(sm, config);
        const result = wf.buildHandoff({
          profileName: selectedDiet,
          fallbackReason: meta?.fallbackReason ?? null,
          previousAgent: meta?.lastAgent !== "none" && meta?.lastAgent ? meta.lastAgent : "codex",
          nextAgent: "claude",
        });
        sm.updateMeta({ status: "handoff_ready", tokenDietProfile: selectedDiet });
        setMessage(`handoff written: ${path.relative(repoRoot, result.handoffPath)}`);
        reload();
      } catch (e: any) {
        setMessage(`handoff failed: ${e?.message ?? e}`);
      }
    }
  });

  React.useEffect(() => {
    const active = initial.project as BatonProject | undefined;
    setSelectedDiet(active?.defaultDiet ?? "balanced");
  }, [initial.project]);

  React.useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  const meta = sm.getMeta();
  const projects = manager.listProjects();
  const activeProject = projects.find(p => p.path === repoRoot) ?? manager.getActiveProject();
  const task = readSafe(sm.files.p("task"), 800);
  const compact = readSafe(sm.files.p("compactState"), 1600) || readSafe(sm.files.p("state"), 1600);
  const changed = readSafe(sm.files.p("changedFiles"), 1000);
  const logTail = readSafe(sm.files.p("commandsLog"), 1800);
  const errors = readSafe(sm.files.p("errors"), 1000);
  let budget: any = null;
  try { budget = JSON.parse(fs.readFileSync(sm.files.p("contextBudget"), "utf8")); } catch {/**/}

  const agents = {
    codex: which(config.agents.codex?.command ?? "codex"),
    claude: which(config.agents.claude?.command ?? "claude"),
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Sidebar
          project={activeProject ?? null}
          projects={projects}
          selectedDiet={selectedDiet}
          primaryAgent={activeProject?.primaryAgent ?? config.primaryAgent}
          fallbackAgent={activeProject?.fallbackAgent ?? config.fallbackAgent}
          agents={agents}
        />
        <Box flexDirection="column" flexGrow={1}>
          <SessionPanel
            task={task}
            meta={meta}
            repoRoot={repoRoot}
            fallbackReason={meta?.fallbackReason ?? null}
          />
          <ChangedFilesPanel changed={changed} compact={compact} />
          <BudgetPanel budget={budget} selectedDiet={selectedDiet} />
          <LogTailPanel logTail={logTail} errors={errors} />
        </Box>
      </Box>
      <StatusBar tick={tick} message={message} />
    </Box>
  );
}
