import * as reactApi from "@db21/toolkit/feature-kit/react";
import { reactProvider } from "@db21/toolkit/feature-kit/react";
import React from "react";
import { expect, test } from "vitest";

type MutableComponent = React.FC<Readonly<{ children: React.ReactNode }>>;

const createAnonymousComponent = (): MutableComponent => {
  const component = (({
    children,
  }: Readonly<{ children: React.ReactNode }>) => {
    return <>{children}</>;
  }) as MutableComponent;

  Object.defineProperty(component, "name", {
    configurable: true,
    value: "",
  });

  return component;
};

// eslint-disable-next-line db21-tests/require-justification -- Runtime implementation details must remain unavailable to consumers of the public React entry point.
test("React runtime implementation details remain excluded from the public API", () => {
  expect("ReactRuntime" in reactApi).toBe(false);
  expect("createEntries" in reactApi).toBe(false);
  expect("runtime" in reactApi).toBe(false);
});

// eslint-disable-next-line db21-tests/require-justification -- Provider names must remain deterministic because ownership diagnostics identify registrations by name.
test("provider name is derived from displayName, component name, then anonymous fallback", () => {
  const displayNamedProvider = ({
    children,
  }: Readonly<{ children: React.ReactNode }>): React.ReactElement => (
    <>{children}</>
  );

  displayNamedProvider.displayName = "DisplayNamedProvider";

  const namedProvider: React.FC<Readonly<{ children: React.ReactNode }>> = ({
    children,
  }) => {
    return <>{children}</>;
  };

  const anonymousProvider = reactProvider({
    dependencies: {},
    component: createAnonymousComponent(),
  });

  expect(
    reactProvider({
      dependencies: {},
      component: displayNamedProvider,
    }).name,
  ).toBe("DisplayNamedProvider");
  expect(
    reactProvider({
      dependencies: {},
      component: namedProvider,
    }).name,
  ).toBe("namedProvider");
  expect(anonymousProvider.name).toBe("AnonymousReactProvider");
});
