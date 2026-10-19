import type { ModuleType } from "./modules.js";

const moduleMetadata = new WeakMap<object, unknown>();

export const setModuleMetadata = (target: object, metadata: unknown): void => {
  moduleMetadata.set(target, metadata);
};

export const getModuleMetadata = (target: ModuleType): unknown => {
  return moduleMetadata.get(target);
};
