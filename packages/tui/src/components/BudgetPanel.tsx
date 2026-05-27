import * as React from "react";
import { Box, Text } from "ink";
import type { DietProfileName } from "@relay-baton/shared";

export function BudgetPanel(props: { budget: any; selectedDiet: DietProfileName }) {
  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column">
      <Text bold color="yellow">Token Budget</Text>
      {props.budget ? (
        <Text>
          profile: <Text color="magenta">{props.budget.profile}</Text> selected: <Text color="magenta">{props.selectedDiet}</Text> handoff: {props.budget.used?.handoff}/{props.budget.maxHandoffChars} truncated: {String(!!props.budget.truncated)}
        </Text>
      ) : (
        <Text>selected: <Text color="magenta">{props.selectedDiet}</Text> snapshot: (none)</Text>
      )}
    </Box>
  );
}
