import type { InjectionToken } from "@db21/toolkit/feature-kit";
import { Application } from "@db21/toolkit/feature-kit";
import {
  FeatureKitError,
  Module,
  type ModuleMetadata,
  type ModuleType,
} from "@db21/toolkit/feature-kit";
import { assert, isDefined } from "@db21/toolkit/utils";
import { expect } from "vitest";

/**
 * Creates a test module fixture with the provided metadata.
 * @param metadata Module metadata to apply.
 * @returns Decorated module fixture type.
 */
export const createModule = (metadata: ModuleMetadata): ModuleType => {
  @Module(metadata)
  class ModuleFixture {}

  return ModuleFixture;
};

/**
 * Resolves a token from a specific Feature Kit module runtime.
 * @param application Runtime application.
 * @param ownerModule Module owning the resolution scope.
 * @param token Symbol token or class constructor.
 * @returns Promise resolving the requested token.
 */
export const resolveFromModule = <T>(
  application: Application,
  ownerModule: ModuleType,
  token: InjectionToken<T>,
): Promise<T> => {
  const context = application.select(ownerModule);

  return context.resolve(token);
};

/**
 * Captures and returns any thrown error from the action.
 * @param action Callback to invoke.
 * @returns Caught error or undefined.
 */
export const captureError = async (action: () => unknown): Promise<unknown> => {
  let error: unknown;

  try {
    await Promise.resolve(action());
  } catch (caught: unknown) {
    error = caught;
  }

  return error;
};

/**
 * Asserts that the action throws a FeatureKitError with the expected code.
 * @param action Callback to invoke.
 * @param code Expected error code.
 * @param messageContains Optional message substring check.
 */
export const expectFeatureKitErrorFrom = async (
  action: () => unknown,
  code: string,
  messageContains?: string,
): Promise<void> => {
  const error = await captureError(action);

  assert.defined(error, `Expected ${code} error.`);
  expect(error).toBeInstanceOf(FeatureKitError);
  expect((error as FeatureKitError).details.code).toEqual(code);

  if (isDefined(messageContains)) {
    expect((error as Error).message).toContain(messageContains);
  }
};

/**
 * Asserts that the action throws a non-FeatureKit error.
 * @param action Callback to invoke.
 * @param messageContains Optional message substring check.
 */
export const expectNativeErrorFrom = async (
  action: () => unknown,
  messageContains?: string,
): Promise<void> => {
  const error = await captureError(action);

  assert.defined(error, "Expected non-FeatureKit failure.");
  expect(error).not.toBeInstanceOf(FeatureKitError);

  if (isDefined(messageContains)) {
    expect((error as Error).message).toContain(messageContains);
  }
};
