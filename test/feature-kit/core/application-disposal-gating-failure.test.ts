import "reflect-metadata";

import {
  Application,
  FeatureKitError,
  Injectable,
  Module,
  type ModuleMetadata,
  type ModuleType,
  PreDestroy,
  token,
} from "@db21/toolkit/feature-kit";
import { assert } from "@db21/toolkit/utils";
import { expect, test } from "vitest";

import {
  captureError,
  expectFeatureKitErrorFrom,
  resolveFromModule,
} from "./test-helpers.js";

/**
 * Creates a module fixture with a module decorator metadata payload.
 * @param metadata Module metadata to attach.
 * @returns A decorated module fixture type.
 */
const createTestModule = (metadata: ModuleMetadata): ModuleType => {
  @Module(metadata)
  class ModuleFixture {}

  return ModuleFixture;
};

/**
 * Creates a deferred promise and resolver tuple.
 * @returns Promise/resolve pair for controlled async synchronization.
 */
const createDeferredState = (): {
  promise: Promise<void>;
  resolve: () => void;
} => {
  let resolve: () => void = () => {
    return;
  };

  const promise = new Promise<void>((resolveValue) => {
    resolve = resolveValue;
  });

  return { promise, resolve };
};

// eslint-disable-next-line db21-tests/require-justification -- Risk: disposal can construct unused services or destroy values owned by callers; Contract: shutdown neither activates unused providers nor disposes caller-provided constants.
test("unused singleton providers stay unconstructed and caller-owned constants remain undisposed", async () => {
  const usedToken = token<string>("used-token");
  const callerOwnedToken = token<{ callback: () => void }>("caller-owned");

  let unusedConstructCount = 0;
  let unusedDestroyCount = 0;
  let callerOwnedDestroyCount = 0;

  @Injectable()
  class UnusedService {
    public constructor() {
      unusedConstructCount += 1;
    }

    @PreDestroy()
    public destroy(): void {
      unusedDestroyCount += 1;
    }
  }

  @Injectable()
  class UsedService {}

  const module = createTestModule({
    configure: ({ bind }) => {
      bind(UnusedService).toSelf().inSingletonScope();
      bind(UsedService).toSelf().inSingletonScope();
      bind(usedToken).toConstantValue("used");
      bind(callerOwnedToken).toConstantValue({
        callback: () => {
          callerOwnedDestroyCount += 1;
        },
      });
    },
  });

  const app = Application.create(module);

  await resolveFromModule(app, module, UsedService);
  await resolveFromModule(app, module, usedToken);

  const firstDispose = app.dispose();
  const secondDispose = app.dispose();

  expect(firstDispose).toBe(secondDispose);
  await firstDispose;

  expect(unusedConstructCount).toBe(0);
  expect(unusedDestroyCount).toBe(0);
  expect(callerOwnedDestroyCount).toBe(0);
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: concurrent shutdown and resolution can create multiple lifecycle boundaries with inconsistent access; Contract: callers share one disposal result and in-flight resolution is gated.
test("dispose gates immediate and in-flight access and returns one shared promise", async () => {
  const delayedToken = token<string>("in-flight-token");
  const resolveGate = createDeferredState();
  const module = createTestModule({
    configure: ({ bind }) => {
      bind(delayedToken)
        .toResolvedValue(async () => {
          await resolveGate.promise;

          return "value";
        })
        .inSingletonScope();
    },
  });

  const app = Application.create(module);

  const inFlightResolution = resolveFromModule(app, module, delayedToken);
  const firstDispose = app.dispose();
  const secondDispose = app.dispose();

  expect(firstDispose).toBe(secondDispose);
  resolveGate.resolve();

  await expectFeatureKitErrorFrom(
    () => inFlightResolution,
    "application_disposed",
  );
  await expectFeatureKitErrorFrom(
    () => resolveFromModule(app, module, delayedToken),
    "application_disposed",
  );

  await firstDispose;
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: cleanup failures can leave concurrent callers with divergent lifecycle outcomes; Contract: concurrent disposal callers receive the same normalized cleanup failure.
test("disposal failure is wrapped as one shared FeatureKit failure", async () => {
  let closeCount = 0;

  @Injectable()
  class FailingService {
    @PreDestroy()
    public destroy(): void {
      closeCount += 1;

      throw new Error("cleanup failed");
    }
  }

  const module = createTestModule({
    configure: ({ bind }) => {
      bind(FailingService).toSelf().inSingletonScope();
    },
  });

  const app = Application.create(module);

  await resolveFromModule(app, module, FailingService);

  const firstDispose = app.dispose();
  const secondDispose = app.dispose();

  expect(firstDispose).toBe(secondDispose);

  const firstError = await captureError(() => firstDispose);
  const secondError = await captureError(() => secondDispose);

  assert.defined(firstError, "Expected disposal to fail.");
  assert.defined(secondError, "Expected disposal to fail.");
  expect(firstError).toBeInstanceOf(FeatureKitError);
  expect(secondError).toBeInstanceOf(FeatureKitError);
  expect((firstError as FeatureKitError).details.code).toEqual(
    "disposal_failed",
  );
  expect(firstError).toBe(secondError);
  expect(closeCount).toBe(1);
});
