import * as reactApi from "@db21/toolkit/feature-kit/react";
import {
  FeatureKitProvider,
  ReactProvider,
  reactProvider,
  RenderSurface,
  Surface,
} from "@db21/toolkit/feature-kit/react";
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

test("public React API exports expose provider and surface entry points", () => {
  const keys = Object.keys(reactApi).toSorted((left, right) =>
    left.localeCompare(right),
  );

  expect(keys).toEqual([
    "FeatureKitProvider",
    "reactProvider",
    "ReactProvider",
    "RenderSurface",
    "Surface",
  ]);
  expect("ReactRuntime" in reactApi).toBe(false);
  expect("createEntries" in reactApi).toBe(false);
  expect("runtime" in reactApi).toBe(false);
});

test("reactProvider returns a ReactProvider instance", () => {
  const component = ({
    children,
  }: Readonly<{ children: React.ReactNode }>): React.ReactElement => (
    <>{children}</>
  );

  expect(ReactProvider).toBeInstanceOf(Function);
  expect(FeatureKitProvider).toBeInstanceOf(Function);
  expect(RenderSurface).toBeInstanceOf(Function);
  expect(Surface).toBeInstanceOf(Function);

  const provider = reactProvider({
    dependencies: {},
    component,
  });

  const providerInstance = new ReactProvider({
    dependencies: {},
    component,
  });

  expect(reactProvider).toBeInstanceOf(Function);
  expect(ReactProvider).toBeInstanceOf(Function);
  expect(provider.component).toBe(component);
  expect(provider.dependencies).toEqual({});
  expect(provider).toBeInstanceOf(ReactProvider);

  expect(providerInstance).toBeInstanceOf(ReactProvider);
  expect(providerInstance.component).toBe(component);
  expect(providerInstance.dependencies).toEqual({});
});

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
