import React, { type FC } from "react";

import type { Application } from "../core/index.js";
import { ReactRuntime } from "./react-runtime.js";
import { ReactRuntimeContext } from "./react-runtime-context.js";
import { ReactProviderComposer } from "./ReactProviderComposer.js";

export type FeatureKitProviderProps = Readonly<{
  /** Feature Kit application runtime context. */
  readonly application: Application;
  /** Fallback rendered while async providers resolve. */
  readonly fallback?: React.ReactNode;
  /** Application children rendered inside composed providers. */
  readonly children: React.ReactNode;
}>;

/**
 * Composes module-owned providers for a Feature Kit application with Suspense.
 */
export const FeatureKitProvider: FC<FeatureKitProviderProps> = ({
  application,
  children,
  fallback = null,
}): React.ReactElement => {
  // Host owns application lifetime; do not dispose from here.
  const runtime = ReactRuntime.forApplication(application);

  return (
    <ReactRuntimeContext.Provider value={runtime}>
      <React.Suspense fallback={fallback}>
        <ReactProviderComposer runtime={runtime}>
          {children}
        </ReactProviderComposer>
      </React.Suspense>
    </ReactRuntimeContext.Provider>
  );
};
