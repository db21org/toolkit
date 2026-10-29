import { Application, token } from "@db21/toolkit/feature-kit";
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

const applicationResolutionCount = 2;

// eslint-disable-next-line db21-tests/require-justification -- Risk: asynchronous provider data is omitted from server-rendered content; Contract: SSR waits for resolved provider dependencies before emitting the tree.
test("FeatureKitProvider suspends and resolves React provider dependencies", async () => {
  const payloadToken = token<string>("payload-token");

  const providerModule = createModule({
    configure: ({ bind }) => {
      bind(payloadToken).toResolvedValue(async () => {
        await Promise.resolve();

        return "loaded";
      });
    },
    reactProviders: [
      reactProvider({
        dependencies: { value: payloadToken },
        component: ({ children, value }) => {
          return (
            <>
              <span>{value}</span>
              {children}
            </>
          );
        },
      }),
    ],
  });

  const app = Application.create(providerModule);

  const html = await renderWithFeatureKit(
    <FeatureKitProvider application={app}>
      <p>child</p>
    </FeatureKitProvider>,
  );

  expect(html).toContain("loaded");
  expect(html).toContain("child");
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: a provider cannot read a dependency private to its owning module; Contract: SSR renders the owner's private dependency value.
test("React provider dependencies resolve from the owning module even when private", async () => {
  const privateToken = token<string>("private-token");

  const privateModule = createModule({
    configure: ({ bind }) => {
      bind(privateToken).toConstantValue("owned");
    },
    reactProviders: [
      reactProvider({
        dependencies: {
          token: privateToken,
        },
        component: ({ children, token }) => {
          return (
            <>
              <span>{token}</span>
              {children}
            </>
          );
        },
      }),
    ],
  });

  const app = Application.create(privateModule);

  const html = await renderWithFeatureKit(
    <FeatureKitProvider application={app}>
      <p>done</p>
    </FeatureKitProvider>,
  );

  expect(html).toContain("owned");
  expect(html).toContain("done");
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: repeated SSR requests duplicate resolution or share values between applications; Contract: each application caches its provider dependency across SSR requests without sharing another application's value.
test("SSR requests cache provider dependencies per application", async () => {
  const tokenValue = token<string>("cached-token");
  let resolveCount = 0;

  const counted = createModule({
    configure: ({ bind }) => {
      bind(tokenValue).toResolvedValue(() => {
        resolveCount += 1;

        return `value-${String(resolveCount)}`;
      });
    },
    reactProviders: [
      reactProvider({
        dependencies: {
          value: tokenValue,
        },
        component: ({ children, value }) => {
          return (
            <>
              <span>{value}</span>
              {children}
            </>
          );
        },
      }),
    ],
  });

  const firstApplication = Application.create(counted);
  const secondApplication = Application.create(counted);
  const firstOutput = (
    <FeatureKitProvider application={firstApplication}>
      <p>children</p>
    </FeatureKitProvider>
  );

  const secondOutput = (
    <FeatureKitProvider application={secondApplication}>
      <p>children</p>
    </FeatureKitProvider>
  );

  const firstRequest = await renderWithFeatureKit(firstOutput);
  const repeatedFirstRequest = await renderWithFeatureKit(firstOutput);
  const secondRequest = await renderWithFeatureKit(secondOutput);

  expect(firstRequest).toContain("value-1");
  expect(repeatedFirstRequest).toContain("value-1");
  expect(secondRequest).toContain("value-2");
  expect(resolveCount).toBe(applicationResolutionCount);
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: a failed dependency produces misleading partial server output; Contract: SSR rejects with the provider dependency error.
test("react-provider dependency errors reject through the suspense render path", async () => {
  const failingToken = token<string>("failing-token");

  const moduleWithFailure = createModule({
    configure: ({ bind }) => {
      bind(failingToken).toResolvedValue(() => {
        throw new Error("provider failed");
      });
    },
    reactProviders: [
      reactProvider({
        dependencies: {
          value: failingToken,
        },
        component: ({ children, value }) => (
          <>
            <span>{value}</span>
            {children}
          </>
        ),
      }),
    ],
  });

  const app = Application.create(moduleWithFailure);

  await expect(
    renderWithFeatureKit(
      <FeatureKitProvider application={app}>
        <p>child</p>
      </FeatureKitProvider>,
    ),
  ).rejects.toThrow("provider failed");
});
