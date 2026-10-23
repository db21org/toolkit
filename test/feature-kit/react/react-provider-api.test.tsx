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

// eslint-disable-next-line db21-tests/require-justification -- Risk: consumers couple to unsupported runtime internals that can change without a compatibility path; Contract: the public React entry point excludes runtime implementation exports.
test("React runtime implementation details remain excluded from the public API", () => {
  expect("ReactRuntime" in reactApi).toBe(false);
  expect("createEntries" in reactApi).toBe(false);
  expect("runtime" in reactApi).toBe(false);
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: provider diagnostics cannot identify registrations consistently; Contract: public provider names prefer displayName, then function name, then the anonymous fallback.
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
