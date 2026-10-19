import type { ContainerModuleLoadOptions } from "inversify";

import { getModuleMetadata, setModuleMetadata } from "./metadata.js";
import type { ClassType, InjectionToken } from "./tokens.js";

/**
 * Reserved extension point for downstream Feature Kit package integration.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export interface ModuleMetadataExtensions {
  readonly featureKitModuleMetadataBrand?: never;
}

/** Constructor carrying Feature Kit module metadata. */
export type ModuleType = ClassType<object>;

/**
 * Module container-setup API.
 * @remarks Keep narrow to avoid exposing a custom provider DSL.
 */
export type ModuleConfigureApi = Readonly<
  Pick<ContainerModuleLoadOptions, "bind" | "onDeactivation">
>;

/** Static module declaration metadata. */
export type ModuleMetadata = {
  readonly configure?: (api: ModuleConfigureApi) => void;
  readonly imports?: readonly ModuleType[];
  readonly exports?: readonly InjectionToken[];
} & ModuleMetadataExtensions;

/**
 * Declares a module and its dependency graph.
 * @param metadata Static module imports and configuration.
 * @returns Class decorator that applies module metadata.
 */
export const Module =
  (metadata: ModuleMetadata): ClassDecorator =>
  (target) => {
    setModuleMetadata(target, metadata);
  };

/**
 * Returns immutable metadata declared for a module.
 * @param moduleType Module constructor to inspect.
 * @returns Metadata or undefined for an undecorated class.
 */
export const inspectModule = (
  moduleType: ModuleType,
): ModuleMetadata | undefined => {
  return getModuleMetadata(moduleType) as ModuleMetadata | undefined;
};
