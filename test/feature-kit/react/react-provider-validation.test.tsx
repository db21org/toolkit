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

// eslint-disable-next-line no-restricted-imports -- Validate private registration types without adding public API.
import { type ReactProviderRegistration } from "../../../src/feature-kit/react/react-provider.js";
// eslint-disable-next-line no-restricted-imports -- Test the private runtime without exporting it publicly.
import { ReactRuntime } from "../../../src/feature-kit/react/react-runtime.js";
import { renderWithFeatureKit } from "./feature-kit-provider-test-helpers.js";

const createFeatureModule = (metadata: ModuleMetadata): ModuleType => {
  @Module(metadata)
  class ModuleFixture {}

  return ModuleFixture;
};

// eslint-disable-next-line db21-tests/require-justification -- Invalid metadata must fail before React renders an untrusted provider registration.
test("invalid react provider runtime creation throws during resolution", () => {
  const badRegistration = {
    notAProvider: true,
  } as unknown as ReactProviderRegistration;

  const badModule = createFeatureModule({
    reactProviders: [badRegistration],
  });

  const app = Application.create(badModule);

  expect(() => ReactRuntime.forApplication(app)).toThrow(
    "invalid react provider registration",
  );
});

// eslint-disable-next-line db21-tests/require-justification -- One provider instance cannot have two owners because dependency scope would become ambiguous.
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

// eslint-disable-next-line db21-tests/require-justification -- React hosts own application lifetime, so rendering must never trigger container disposal.
test("FeatureKitProvider never calls host application dispose", async () => {
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
