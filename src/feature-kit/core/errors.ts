import { isDefined } from "@db21/toolkit/utils";

import { getTokenName, type InjectionToken } from "./tokens.js";

export type FeatureKitErrorCode =
  | "application_disposed"
  | "disposal_failed"
  | "module_import_cycle"
  | "module_not_registered"
  | "module_export_not_owned"
  | "undecorated_module";

export type FeatureKitErrorDetails = Readonly<{
  code: FeatureKitErrorCode;
  token?: string;
  module?: string;
  path?: string;
}>;

/** Structured framework failure for FeatureKit runtime diagnostics. */
export class FeatureKitError extends Error {
  public readonly details: FeatureKitErrorDetails;

  /**
   * Creates a structured framework failure.
   * @param message Human-readable diagnostic.
   * @param details Structured diagnostics payload.
   * @param options Optional ErrorOptions.
   */
  public constructor(
    message: string,
    details: FeatureKitErrorDetails,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "FeatureKitError";
    this.details = Object.freeze(details);
  }
}

const createError = (
  message: string,
  details: FeatureKitErrorDetails,
  cause?: unknown,
): FeatureKitError => {
  if (isDefined(cause)) {
    return new FeatureKitError(message, details, { cause });
  }

  return new FeatureKitError(message, details);
};

export const createDisposedApplicationError = (): FeatureKitError =>
  createError("Cannot access disposed feature application.", {
    code: "application_disposed",
  });

export const createDisposedTokenError = <T>(
  token: InjectionToken<T>,
): FeatureKitError =>
  createError(`Cannot access token "${getTokenName(token)}" after disposal.`, {
    code: "application_disposed",
    token: getTokenName(token),
  });

export const createDisposalFailedError = (cause: unknown): FeatureKitError =>
  createError(
    "Failed to dispose application resources.",
    {
      code: "disposal_failed",
    },
    cause,
  );

export const createUndecoratedModuleError = (moduleType: {
  readonly name: string | undefined;
}): FeatureKitError => {
  const moduleName = moduleType.name ?? "<anonymous>";

  return createError(`Cannot use module "${moduleName}" without @Module().`, {
    code: "undecorated_module",
    module: moduleName,
  });
};

export const createModuleImportCycleError = (
  path: readonly string[],
): FeatureKitError =>
  createError(`Detected circular module import: ${path.join(" -> ")}.`, {
    code: "module_import_cycle",
    path: path.join(" -> "),
  });

export const createModuleExportNotOwnedError = (
  moduleType: {
    readonly name: string | undefined;
  },
  token: InjectionToken,
): FeatureKitError => {
  const moduleName = moduleType.name ?? "<anonymous>";

  return createError(
    `Cannot export token "${getTokenName(token)}" from module "${moduleName}" because it is not a direct local binding.`,
    {
      code: "module_export_not_owned",
      module: moduleName,
      token: getTokenName(token),
    },
  );
};

export const createModuleNotRegisteredError = (moduleType: {
  readonly name: string | undefined;
}): FeatureKitError => {
  const moduleName = moduleType.name ?? "<anonymous>";

  return createError(
    `Cannot resolve token from module "${moduleName}" because it is not registered with this application.`,
    {
      code: "module_not_registered",
      module: moduleName,
    },
  );
};
