import React from "react";

import { ReactRuntime } from "./react-runtime.js";

/** Internal Feature Kit React runtime context for internal renderer wiring. */
export const ReactRuntimeContext = React.createContext<
  ReactRuntime | undefined
>(undefined);
