import { assert } from "@db21/toolkit/utils";
import React, { use } from "react";

import { ReactRuntimeContext } from "./react-runtime-context.js";
import * as SurfaceModule from "./surface.js";

/**
 * Public RenderSurface props for a concrete Surface constructor.
 */
type SurfaceRenderProps<Surface extends SurfaceModule.SurfaceConstructor> =
  SurfaceModule.SurfaceRenderProps<Surface>;

export type RenderSurfaceProps<
  Surface extends SurfaceModule.SurfaceConstructor,
> = Readonly<{
  readonly surface: Surface;
}> &
  ([SurfaceRenderProps<Surface>] extends [undefined]
    ? {
        readonly props?: undefined;
      }
    : {
        readonly props: NoInfer<SurfaceRenderProps<Surface>>;
      });

/**
 * Renders a discovered Surface instance inside the Feature Kit suspense boundary.
 */
// eslint-disable-next-line react-conventions/component-style
export const RenderSurface = <
  SurfaceType extends SurfaceModule.SurfaceConstructor,
>(
  props: RenderSurfaceProps<SurfaceType>,
): SurfaceModule.SurfaceRenderResult => {
  const resolution = SurfaceModule.getSurfaceResolution(props.surface);
  const runtime = React.useContext(ReactRuntimeContext);

  const surfaceInstance =
    resolution === "direct"
      ? SurfaceModule.instantiateDirectSurface(props.surface)
      : instantiateManagedSurface(runtime, props.surface, resolution);
  const nestedProps = props.props as SurfaceRenderProps<SurfaceType>;

  return invokeSurfaceRender(surfaceInstance, nestedProps);
};

const instantiateManagedSurface = <
  SurfaceType extends SurfaceModule.SurfaceConstructor,
>(
  runtime: React.ContextType<typeof ReactRuntimeContext>,
  surface: SurfaceType,
  resolution: Exclude<SurfaceModule.SurfaceResolution, "direct">,
): SurfaceModule.SurfaceInstance<SurfaceType> => {
  assert.defined(
    runtime,
    "Cannot render a managed Surface outside a FeatureKitProvider. Wrap this tree in <FeatureKitProvider>.",
  );

  // React's `use` API may be called conditionally, unlike conventional Hooks.
  return resolution === "sync"
    ? runtime.instantiateSurfaceSync(surface)
    : use(runtime.instantiateSurface(surface));
};

const ensureSurfaceRenderResult = (
  renderResult: unknown,
): SurfaceModule.SurfaceRenderResult => {
  assert.true(
    Object.is(renderResult, null) || React.isValidElement(renderResult),
    "Surface.render() must return a ReactElement or null.",
  );

  return renderResult as SurfaceModule.SurfaceRenderResult;
};

const invokeSurfaceRender = <
  SurfaceType extends SurfaceModule.SurfaceConstructor,
>(
  surfaceInstance: Readonly<{
    render(
      props: SurfaceRenderProps<SurfaceType>,
    ): SurfaceModule.SurfaceRenderResult;
  }>,
  props: SurfaceRenderProps<SurfaceType>,
): SurfaceModule.SurfaceRenderResult => {
  const result = surfaceInstance.render(props);

  return ensureSurfaceRenderResult(result);
};
