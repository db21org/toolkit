import { Application } from "@db21/toolkit/feature-kit";
import {
  FeatureKitProvider,
  reactProvider,
} from "@db21/toolkit/feature-kit/react";
import React from "react";
import { expect, test } from "vitest";

import {
  createModule,
  renderWithFeatureKit,
} from "./feature-kit-provider-test-helpers.js";

const createAnonymousMarker = (
  name: string,
): React.FC<Readonly<{ children: React.ReactNode }>> => {
  const marker = (({
    children,
  }: Readonly<{ children: React.ReactNode }>): React.ReactElement => {
    return <section data-provider={name}>{children}</section>;
  }) as React.FC<Readonly<{ children: React.ReactNode }>>;

  Object.defineProperty(marker, "name", {
    configurable: true,
    value: "",
  });

  return marker;
};

// eslint-disable-next-line db21-tests/require-justification -- Risk: module providers compose in an order that makes nested dependencies unavailable or drops anonymous providers; Contract: SSR emits all anonymous provider boundaries in dependency-first nesting order.
test("provider composition nests anonymous providers in dependency-first module order", async () => {
  const dependencyModule = createModule({
    reactProviders: [
      reactProvider({
        dependencies: {},
        component: createAnonymousMarker("dependency"),
      }),
    ],
  });

  const rootModule = createModule({
    imports: [dependencyModule],
    reactProviders: [
      reactProvider({
        dependencies: {},
        component: createAnonymousMarker("root-first"),
      }),
      reactProvider({
        dependencies: {},
        component: createAnonymousMarker("root-second"),
      }),
    ],
  });

  const app = Application.create(rootModule);

  const html = await renderWithFeatureKit(
    <FeatureKitProvider application={app}>
      <p>children</p>
    </FeatureKitProvider>,
  );

  expect(html).toContain(
    '<section data-provider="dependency"><section data-provider="root-first"><section data-provider="root-second"><p>children</p>',
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: a diamond module graph duplicates a shared provider's observable output; Contract: SSR applies the shared provider as one boundary around its child content.
test("shared module React providers are composed once in SSR output", async () => {
  const sharedRegistration = reactProvider({
    dependencies: {},
    component: ({ children }: Readonly<{ children: React.ReactNode }>) => (
      <section data-provider="shared">{children}</section>
    ),
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

  const html = await renderWithFeatureKit(
    <FeatureKitProvider application={app}>
      <span>shared</span>
    </FeatureKitProvider>,
  );

  expect(html).toContain('<section data-provider="shared"><span>shared</span>');
});
