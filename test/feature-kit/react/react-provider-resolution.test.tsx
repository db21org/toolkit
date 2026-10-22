import { Application, token } from "@db21/toolkit/feature-kit";
import {
  FeatureKitProvider,
  reactProvider,
} from "@db21/toolkit/feature-kit/react";
import { assert } from "@db21/toolkit/utils";
import React from "react";
import { expect, test } from "vitest";

// eslint-disable-next-line no-restricted-imports -- Test the private runtime without exporting it publicly.
import { ReactRuntime } from "../../../src/feature-kit/react/react-runtime.js";
import {
  createModule,
  renderWithFeatureKit,
} from "./feature-kit-provider-test-helpers.js";

// eslint-disable-next-line db21-tests/require-justification -- Provider dependencies must suspend safely and render only after asynchronous values are available.
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

// eslint-disable-next-line db21-tests/require-justification -- A provider needs its owner's private dependencies without making them visible to other modules.
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

// eslint-disable-next-line db21-tests/require-justification -- React replay must reuse provider dependency work instead of triggering duplicate side effects.
test("react-provider dependency promise is cached across re-renders", async () => {
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

  const app = Application.create(counted);
  const output = (
    <FeatureKitProvider application={app}>
      <p>children</p>
    </FeatureKitProvider>
  );

  await renderWithFeatureKit(output);
  await renderWithFeatureKit(output);

  expect(resolveCount).toBe(1);
});

// eslint-disable-next-line db21-tests/require-justification -- Each application needs isolated runtime state while remounts reuse its registered ownership map.
test("ReactRuntime.forApplication is cached per application", () => {
  const app = Application.create(
    createModule({
      reactProviders: [
        reactProvider({
          dependencies: {},
          component: ({ children }) => <>{children}</>,
        }),
      ],
    }),
  );

  const runtimeOne = ReactRuntime.forApplication(app);
  const runtimeTwo = ReactRuntime.forApplication(app);
  const appTwo = Application.create(
    createModule({
      reactProviders: [
        reactProvider({
          dependencies: {},
          component: ({ children }) => <>{children}</>,
        }),
      ],
    }),
  );

  const runtimeThree = ReactRuntime.forApplication(appTwo);

  expect(runtimeOne).toBe(runtimeTwo);
  expect(runtimeThree).not.toBe(runtimeOne);
});

// eslint-disable-next-line db21-tests/require-justification -- React use() replay requires the exact same dependency Promise identity for a provider registration.
test("resolveDependencies returns stable promise identity", async () => {
  const tokenValue = token<string>("stable-dependency-token");
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

  const app = Application.create(counted);
  const runtime = ReactRuntime.forApplication(app);
  const entry = runtime.entries[0];

  assert.defined(
    entry,
    "Expected a runtime entry for dependency resolution test.",
  );

  const first = runtime.resolveDependencies(entry);
  const second = runtime.resolveDependencies(entry);

  expect(first).toBe(second);

  const values = await Promise.all([first, second]);

  expect(values[0]).toEqual({ value: "value-1" });
  expect(values[1]).toBe(values[0]);
  expect(resolveCount).toBe(1);
});

// eslint-disable-next-line db21-tests/require-justification -- Provider dependency failures must propagate through Suspense rather than producing a partial tree.
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
