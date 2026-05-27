import * as React from "react";
import { Box, Text } from "ink";
import type { AgentId, BatonProject, DietProfileName } from "@relay-baton/shared";

interface Props {
  project: BatonProject | null;
  projects: BatonProject[];
  selectedDiet: DietProfileName;
  primaryAgent: AgentId;
  fallbackAgent: AgentId;
  agents: { codex: boolean; claude: boolean };
}

export function Sidebar(props: Props) {
  return (
    <Box width={38} flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column">
        <Text bold color="cyanBright">relay-baton</Text>
        <Text dimColor>Token-aware handoff harness</Text>
      </Box>
      <Box borderStyle="round" paddingX={1} flexDirection="column">
        <Text bold>Project</Text>
        <Text>{props.project?.name ?? "(cwd)"}</Text>
        <Text dimColor>{props.project?.path ?? "no active project"}</Text>
        <Text>diet: <Text color="magenta">{props.selectedDiet}</Text></Text>
        <Text>agents: {props.primaryAgent} -&gt; {props.fallbackAgent}</Text>
      </Box>
      <Box borderStyle="round" paddingX={1} flexDirection="column">
        <Text bold>Projects</Text>
        {props.projects.length === 0 ? (
          <Text dimColor>(none registered)</Text>
        ) : props.projects.map(p => (
          <Text key={p.id} color={p.id === props.project?.id ? "cyan" : undefined}>
            {p.id === props.project?.id ? "*" : " "} {p.name}
          </Text>
        ))}
      </Box>
      <Box borderStyle="round" paddingX={1} flexDirection="column">
        <Text bold>Agents</Text>
        <Text>codex: {props.agents.codex ? <Text color="green">available</Text> : <Text color="red">missing</Text>}</Text>
        <Text>claude: {props.agents.claude ? <Text color="green">available</Text> : <Text color="red">missing</Text>}</Text>
      </Box>
      <Box borderStyle="round" paddingX={1} flexDirection="column">
        <Text bold>Keys</Text>
        <Text>q quit   r refresh</Text>
        <Text>p project d diet</Text>
        <Text>h handoff b budget</Text>
      </Box>
    </Box>
  );
}
