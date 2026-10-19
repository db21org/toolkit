import { assert, isDefined, isNotEmpty, type Maybe } from "@db21/toolkit/utils";
import type React from "react";

import { type ClassType, Injectable } from "../core/index.js";

const surfaceKind = Symbol("feature-kit-react-surface");
const anonymousSurfaceName = "AnonymousSurface";

export type SurfaceResolution = "async" | "direct" | "sync";

export type SurfaceOptions =
  | Readonly<{
      /** Controls whether dependency construction may suspend React rendering. */
      readonly resolution?: Exclude<SurfaceResolution, "direct">;
    }>
  | Readonly<{
      // TODO(tech-debt): Remove direct Surface resolution and its global cache
      // after dependency-free routes render screens directly.
      /**
       * Bypasses Feature Kit dependency construction and module registration.
       * Prefer rendering a React screen component directly in new code when an
       * entry point has no injected dependencies; this mode supports gradual
       * migration of existing Surface APIs.
       */
      readonly resolution: "direct";
    }>;

export type SurfaceRenderResult = Maybe<React.ReactElement>;

/** Neutral surface constructor shape used across public and runtime types. */
export type SurfaceConstructor = ClassType<object>;

/**
 * Empty surface props contract.
 *
 * Rendered with a single explicit `undefined` argument.
 */
export type EmptySurfaceProps = undefined;
type SurfaceRegistrationMarker = Readonly<{
  readonly [surfaceKind]: true;
}>;

const surfaceResolution = new WeakMap<SurfaceConstructor, SurfaceResolution>();
const directSurfaceInstances = new WeakMap<
  SurfaceConstructor,
  SurfaceInstance<SurfaceConstructor>
>();

/**
 * Public constructor/prototype contract for a Surface implementation.
 *
 * @template Props - The concrete props argument required by `render()`.
 */
export type SurfaceType<
  Props extends EmptySurfaceProps | object = EmptySurfaceProps,
> = SurfaceConstructor & {
  readonly prototype: {
    render(props: Props): SurfaceRenderResult;
  };
};

type DirectSurfaceType<
  Props extends EmptySurfaceProps | object = EmptySurfaceProps,
> = SurfaceType<Props> & (new () => object);

type SurfaceRegistration = SurfaceConstructor & SurfaceRegistrationMarker;

/**
 * Extracts the concrete props argument from a Surface constructor.
 */
export type SurfaceRenderProps<TSurface extends SurfaceConstructor> =
  TSurface extends SurfaceType<infer Props> ? Props : never;

/**
 * Structural instance contract for a valid Surface.
 */
export type SurfaceInstance<TSurface extends SurfaceConstructor> = {
  render(props: SurfaceRenderProps<TSurface>): SurfaceRenderResult;
};

/**
 * Type guard for decorated Surface constructors.
 *
 * @param candidate - Candidate constructor value.
 * @returns True when the constructor is marked as a Surface.
 */
export const isSurface = (
  candidate: unknown,
): candidate is SurfaceRegistration => {
  const candidateAsSurface = candidate as SurfaceRegistrationMarker;

  return (
    isDefined(candidate) &&
    typeof candidate === "function" &&
    Object.hasOwn(candidateAsSurface, surfaceKind)
  );
};

/**
 * Human-readable Surface name.
 *
 * @param surface - Candidate Surface constructor.
 * @returns Stable display name for diagnostics and logs.
 */
export const getSurfaceName = (surface: unknown): string => {
  if (isDefined(surface) && typeof surface === "function") {
    return isNotEmpty(surface.name) ? surface.name : anonymousSurfaceName;
  }

  return anonymousSurfaceName;
};

/**
 * Returns the declared dependency resolution mode for a Surface.
 *
 * @param surface - Decorated Surface constructor.
 * @returns Explicit resolution mode, defaulting to asynchronous construction.
 */
export const getSurfaceResolution = (
  surface: SurfaceConstructor,
): SurfaceResolution => surfaceResolution.get(surface) ?? "async";

/**
 * Constructs a dependency-free Surface without a Feature Kit application.
 *
 * @param surface - Direct Surface constructor.
 * @returns Cached dependency-free Surface instance.
 */
export const instantiateDirectSurface = <TSurface extends SurfaceConstructor>(
  surface: TSurface,
): SurfaceInstance<TSurface> => {
  assert.true(
    getSurfaceResolution(surface) === "direct",
    `Surface "${getSurfaceName(surface)}" is not configured for direct rendering.`,
  );

  const cached = directSurfaceInstances.get(surface);

  if (isDefined(cached)) {
    return cached;
  }

  const instance = Reflect.construct(surface, []) as SurfaceInstance<TSurface>;

  directSurfaceInstances.set(surface, instance);

  return instance;
};

/**
 * Register a class as a Surface.
 *
 * @param options - Surface dependency resolution behavior.
 * @param options.resolution - Direct construction without Feature Kit DI.
 * @returns A class decorator that marks the target with Surface metadata.
 */
export function Surface<
  Props extends EmptySurfaceProps | object = EmptySurfaceProps,
>(options: {
  readonly resolution: "direct";
}): (target: DirectSurfaceType<Props>) => void;
export function Surface<
  Props extends EmptySurfaceProps | object = EmptySurfaceProps,
>(
  options?: Readonly<{ readonly resolution?: "async" | "sync" }>,
): (target: SurfaceType<Props>) => void;

export function Surface<
  Props extends EmptySurfaceProps | object = EmptySurfaceProps,
>(options: SurfaceOptions = {}): (target: SurfaceType<Props>) => void {
  return (target: SurfaceType<Props>): void => {
    const renderMethod = Reflect.get(target.prototype, "render");

    assert.defined(
      renderMethod,
      "Cannot register a Surface class without a render method.",
    );

    assert.true(
      typeof renderMethod === "function",
      "Cannot register a Surface without a render method implementation.",
    );

    const resolution = options.resolution ?? "async";

    if (resolution !== "direct") {
      Injectable()(target);
    }

    surfaceResolution.set(target, resolution);

    Object.defineProperty(target, surfaceKind, {
      configurable: false,
      enumerable: false,
      value: true,
      writable: false,
    });
  };
}
