import "reflect-metadata";

import {
  Application,
  Module,
  type ModuleMetadata,
  type ModuleType,
  token,
} from "@db21/toolkit/feature-kit";
import { expect, test } from "vitest";

import {
  captureError,
  expectFeatureKitErrorFrom,
  expectNativeErrorFrom,
} from "./test-helpers.js";

const createTestModule = (metadata: ModuleMetadata): ModuleType => {
  @Module(metadata)
  class ModuleFixture {}

  return ModuleFixture;
};

// eslint-disable-next-line db21-tests/require-justification -- Module ordering and immutability prevent consumers from observing mutable dependency topology.
test("Application modules are dependency-first and immutable", () => {
  const leaf = createTestModule({});
  const middle = createTestModule({
    imports: [leaf],
  });

  const rootModule = createTestModule({
    imports: [middle, leaf],
  });

  const app = Application.create(rootModule);

  expect(app.modules).toEqual([leaf, middle, rootModule]);
  expect(Object.isFrozen(app.modules)).toBe(true);
});

// eslint-disable-next-line db21-tests/require-justification -- Cached module contexts must preserve private ownership without exposing sibling module bindings.
test("Application.select returns stable root/private ModuleContext objects", async () => {
  const privateToken = token<string>("private-token");
  const sharedToken = token<string>("shared-token");

  const privateModule = createTestModule({
    configure: ({ bind }) => {
      bind(privateToken).toConstantValue("private");
    },
  });

  const rootModule = createTestModule({
    imports: [privateModule],
    configure: ({ bind }) => {
      bind(sharedToken).toConstantValue("shared");
    },
  });

  const app = Application.create(rootModule);

  const privateContext = app.select(privateModule);
  const privateContextAgain = app.select(privateModule);
  const rootContext = app.select(rootModule);

  expect(privateContext).toBe(privateContextAgain);

  const privateValue = await privateContext.resolve(privateToken);
  const sharedValue = await rootContext.resolve(sharedToken);

  expect(privateValue).toBe("private");
  expect(sharedValue).toBe("shared");

  await expectNativeErrorFrom(() => {
    return privateContext.resolve(sharedToken);
  }, "No bindings found");
});

// eslint-disable-next-line db21-tests/require-justification -- Disposal must synchronously reject later public access and retain one lifecycle promise.
test("Application.assertActive is observable on active and disposed applications", () => {
  const app = Application.create(
    createTestModule({
      configure: ({ bind }) => {
        bind(token<string>("value")).toConstantValue("ok");
      },
    }),
  );

  expect(() => {
    app.assertActive();
  }).not.toThrow();

  const dispose = app.dispose();

  expect(() => {
    app.assertActive();
  }).toThrow("disposed feature application");

  expect(dispose).toBe(app.dispose());
});

// eslint-disable-next-line db21-tests/require-justification -- Selecting an unregistered module must fail before it can expose another module's bindings.
test("Application.select rejects unregistered modules", async () => {
  const ownerModule = createTestModule({
    configure: ({ bind }) => {
      bind(token<string>("owner")).toConstantValue("owner");
    },
  });
  const foreignModule = createTestModule({});

  const app = Application.create(ownerModule);

  await expectFeatureKitErrorFrom(
    () => app.select(foreignModule).resolve(token<string>("owner")),
    "module_not_registered",
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Root and cached context resolutions must both fail when disposal races asynchronous construction.
test("disposal gates both application and cached module contexts", async () => {
  const inFlightToken = token<string>("in-flight");
  let release = false;

  const dependencyModule = createTestModule({
    configure: ({ bind }) => {
      bind(inFlightToken)
        .toResolvedValue(async () => {
          while (!release) {
            await Promise.resolve();
          }

          return "value";
        })
        .inSingletonScope();
    },
  });

  const app = Application.create(dependencyModule);
  const moduleContext = app.select(dependencyModule);

  const inFlightRoot = app.resolve(inFlightToken);
  const inFlightFromContext = moduleContext.resolve(inFlightToken);

  const dispose = app.dispose();

  release = true;

  await expectFeatureKitErrorFrom(() => {
    return inFlightRoot;
  }, "application_disposed");

  await expectFeatureKitErrorFrom(() => {
    return inFlightFromContext;
  }, "application_disposed");

  await expectFeatureKitErrorFrom(() => {
    return moduleContext.resolve(inFlightToken);
  }, "application_disposed");
  await expectFeatureKitErrorFrom(() => {
    return app.select(dependencyModule).resolve(inFlightToken);
  }, "application_disposed");

  const disposeError = await captureError(() => dispose);

  expect(disposeError).toBeUndefined();
});
