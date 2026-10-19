import type { ReactProviderRegistration } from "./react-provider.js";
import type { SurfaceConstructor } from "./surface.js";

declare module "@db21/toolkit/feature-kit" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- interface merging requires declaration merging to stay compatible
  interface ModuleMetadataExtensions {
    readonly reactProviders?: readonly ReactProviderRegistration[];
    readonly surfaces?: readonly SurfaceConstructor[];
  }
}
