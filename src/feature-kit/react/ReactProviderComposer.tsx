import React, { type FC } from "react";

import { ReactProviderEntryRenderer } from "./components/ReactProviderEntryRenderer.js";
import type { ReactRuntime } from "./react-runtime.js";

type ReactProviderComposerProps = Readonly<{
  readonly runtime: ReactRuntime;
  readonly children: React.ReactNode;
}>;

/**
 * Composes validated React providers into a nested tree.
 */
export const ReactProviderComposer: FC<ReactProviderComposerProps> = ({
  runtime,
  children,
}): React.ReactElement => {
  const entries = runtime.entries;

  let tree: React.ReactNode = children;

  // Backward iteration preserves dependency-first declaration order as outer-to-inner wrappers.
  for (const entry of entries.toReversed()) {
    tree = (
      <ReactProviderEntryRenderer
        key={entry.key}
        entry={entry}
        runtime={runtime}
      >
        {tree}
      </ReactProviderEntryRenderer>
    );
  }

  return <>{tree}</>;
};
