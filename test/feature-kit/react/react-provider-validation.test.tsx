import {
  Application,
  Module,
  type ModuleMetadata,
  type ModuleType,
} from "@db21/toolkit/feature-kit";
import {
  FeatureKitProvider,
  reactProvider,
} from "@db21/toolkit/feature-kit/react";
import React from "react";
import { expect, test, vi } from "vitest";

// eslint-disable-next-line no-restricted-imports -- Existing validation test uses internal runtime; public rendering replacement deferred by test policy.
import { ReactRuntime } from "../../../src/feature-kit/react/react-runtime.js";
import { renderWithFeatureKit } from "./feature-kit-provider-test-helpers.js";

const createFeatureModule = (metadata: ModuleMetadata): ModuleType => {
  @Module(metadata)
  class ModuleFixture {}

  return ModuleFixture;
};

// eslint-disable-next-line db21-tests/require-justification -- Risk: invalid provider metadata enters the React runtime as trusted registration; Contract: existing kernel validation rejects invalid registrations before any render boundary.
test("invalid react provider runtime creation throws during resolution", () => {
  const badRegistration = {
    notAProvider: true,
  };

  const badModule = createFeatureModule({
    // @ts-expect-error -- Deliberately invalid metadata must be rejected at runtime.
    reactProviders: [badRegistration],
  });

  const app = Application.create(badModule);

  expect(() => ReactRuntime.forApplication(app)).toThrow(
    "invalid react provider registration",
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: one provider receives dependencies from an ambiguous module owner; Contract: existing kernel validation rejects duplicate ownership before any render boundary.
test("duplicate runtime ownership is rejected", () => {
  const shared = reactProvider({
    dependencies: {},
    component: ({ children }: Readonly<{ children: React.ReactNode }>) => (
      <>{children}</>
    ),
  });

  const ownerOne = createFeatureModule({
    reactProviders: [shared],
  });

  const ownerTwo = createFeatureModule({
    reactProviders: [shared],
  });

  const root = createFeatureModule({ imports: [ownerOne, ownerTwo] });
  const app = Application.create(root);

  expect(() => ReactRuntime.forApplication(app)).toThrow("multiple owners");
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: server rendering disposes an application still owned by its host; Contract: SSR leaves the host application's dispose method untouched.
test("FeatureKitProvider SSR does not dispose the host application", async () => {
  const providerModule = createFeatureModule({
    reactProviders: [
      reactProvider({
        dependencies: {},
        component: ({ children }: Readonly<{ children: React.ReactNode }>) =>
          children,
      }),
    ],
  });

  const app = Application.create(providerModule);
  const disposeSpy = vi.spyOn(app, "dispose");

  await renderWithFeatureKit(
    <FeatureKitProvider application={app}>
      <p>keep</p>
    </FeatureKitProvider>,
  );

  expect(disposeSpy).not.toHaveBeenCalled();
});
