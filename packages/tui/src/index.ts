import * as React from "react";
import { render } from "ink";
import { App, AppProps } from "./App";

export async function startTui(props: AppProps = {}): Promise<void> {
  const { waitUntilExit } = render(React.createElement(App, props));
  await waitUntilExit();
}
