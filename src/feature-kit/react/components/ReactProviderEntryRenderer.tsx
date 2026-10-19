import React, { use } from "react";

import type { ReactProviderEntry, ReactRuntime } from "../react-runtime.js";

type ReactProviderEntryRendererProps = Readonly<{
  readonly entry: ReactProviderEntry;
  readonly runtime: ReactRuntime;
  readonly children: React.ReactNode;
}>;

/**
 * Resolves and renders one React provider entry in the composition chain.
 */
export const ReactProviderEntryRenderer: React.FC<
  ReactProviderEntryRendererProps
> = ({ entry, runtime, children }): React.ReactElement => {
  const dependencies = use(runtime.resolveDependencies(entry));
  const Component = entry.provider.component;

  return <Component {...dependencies}>{children}</Component>;
};
