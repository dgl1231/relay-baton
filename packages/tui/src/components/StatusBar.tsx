import * as React from "react";
import { Box, Text } from "ink";

export function StatusBar(props: { tick: number; message: string }) {
  return (
    <Box paddingX={1}>
      <Text dimColor>tick {props.tick}  </Text>
      <Text color="cyan">q</Text><Text dimColor> quit  </Text>
      <Text color="cyan">r</Text><Text dimColor> refresh  </Text>
      <Text color="cyan">p</Text><Text dimColor> project  </Text>
      <Text color="cyan">d</Text><Text dimColor> diet  </Text>
      <Text color="cyan">h</Text><Text dimColor> handoff no-run  </Text>
      <Text color="cyan">b</Text><Text dimColor> budget  </Text>
      <Text>{props.message}</Text>
    </Box>
  );
}
