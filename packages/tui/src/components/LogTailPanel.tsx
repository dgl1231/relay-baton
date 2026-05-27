import * as React from "react";
import { Box, Text } from "ink";

export function LogTailPanel(props: { logTail: string; errors: string }) {
  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column">
      <Text bold color="yellow">commands.log / Errors</Text>
      <Text>{props.logTail.trim() || "(empty)"}</Text>
      <Text color="red">{props.errors.trim() || ""}</Text>
    </Box>
  );
}
