import { Application } from "@db21/toolkit/feature-kit";
import {
  FeatureKitProvider,
  reactProvider,
} from "@db21/toolkit/feature-kit/react";
import React from "react";
import { expect, test } from "vitest";

// eslint-disable-next-line no-restricted-imports -- Test the private runtime without exporting it publicly.
import { ReactRuntime } from "../../../src/feature-kit/react/react-runtime.js";
import {
  createModule,
  renderWithFeatureKit,
} from "./feature-kit-provider-test-helpers.js";

test("provider composition follows dependency-first module order", async () => {
  const order: string[] = [];

  const dependencyMarker = ({
    children,
  }: Readonly<{ children: React.ReactNode }>): React.ReactElement => {
    order.push("dependency");

    return <>{children}</>;
  };

  const rootFirst = ({
    children,
  }: Readonly<{ children: React.ReactNode }>): React.ReactElement => {
    order.push("root-first");

    return <>{children}</>;
  };

  const rootSecond = ({
    children,
  }: Readonly<{ children: React.ReactNode }>): React.ReactElement => {
    order.push("root-second");

    return <>{children}</>;
  };

  const dependencyModule = createModule({
    reactProviders: [
      reactProvider({
        dependencies: {},
        component: dependencyMarker,
      }),
    ],
  });

  const rootModule = createModule({
    imports: [dependencyModule],
    reactProviders: [
      reactProvider({
        dependencies: {},
        component: rootFirst,
      }),
      reactProvider({
        dependencies: {},
        component: rootSecond,
      }),
    ],
  });

  const app = Application.create(rootModule);

  await renderWithFeatureKit(
    <FeatureKitProvider application={app}>
      <p>children</p>
    </FeatureKitProvider>,
  );

  expect(order).toEqual(["dependency", "root-first", "root-second"]);
});

test("shared module React providers are composed once", async () => {
  let seen = 0;

  const sharedRegistration = reactProvider({
    dependencies: {},
    component: ({ children }: Readonly<{ children: React.ReactNode }>) => {
      seen += 1;

      return <>{children}</>;
    },
  });

  const shared = createModule({
    reactProviders: [sharedRegistration],
  });
  const branchOne = createModule({ imports: [shared] });
  const branchTwo = createModule({ imports: [shared] });
  const root = createModule({
    imports: [branchOne, branchTwo],
  });

  const app = Application.create(root);

  await renderWithFeatureKit(
    <FeatureKitProvider application={app}>
      <span>shared</span>
    </FeatureKitProvider>,
  );

  expect(seen).toBe(1);
});

test("provider names are derived from displayName and component declarations", () => {
  const displayNameComponent = ({
    children,
  }: Readonly<{ children: React.ReactNode }>): React.ReactElement => (
    <>{children}</>
  );

  displayNameComponent.displayName = "DisplayNamedProvider";

  const namedProvider: React.FC<Readonly<{ children: React.ReactNode }>> = ({
    children,
  }) => {
    return <>{children}</>;
  };

  const module = createModule({
    reactProviders: [
      reactProvider({
        dependencies: {},
        component: displayNameComponent,
      }),
      reactProvider({
        dependencies: {},
        component: namedProvider,
      }),
    ],
  });

  const runtime = ReactRuntime.forApplication(Application.create(module));

  expect(runtime.entries[0]?.provider.name).toBe("DisplayNamedProvider");
  expect(runtime.entries[1]?.provider.name).toBe("namedProvider");
});

test("anonymous provider names collide but keys remain stable and unique", () => {
  const createAnonymous = (): React.FC<
    Readonly<{ children: React.ReactNode }>
  > => {
    const component = (({
      children,
    }: Readonly<{ children: React.ReactNode }>) => {
      return <>{children}</>;
    }) as React.FC<Readonly<{ children: React.ReactNode }>>;

    Object.defineProperty(component, "name", {
      configurable: true,
      value: "",
    });

    return component;
  };

  const module = createModule({
    reactProviders: [
      reactProvider({
        dependencies: {},
        component: createAnonymous(),
      }),
      reactProvider({
        dependencies: {},
        component: createAnonymous(),
      }),
    ],
  });

  const runtime = ReactRuntime.forApplication(Application.create(module));
  const [first, second] = runtime.entries;

  expect(first?.provider.name).toBe("AnonymousReactProvider");
  expect(second?.provider.name).toBe("AnonymousReactProvider");
  expect(first?.key).not.toBe(second?.key);
  expect(first?.key).toBe(0);
  expect(second?.key).toBe(1);
});
