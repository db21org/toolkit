import "reflect-metadata";

import {
  Application,
  Inject,
  Injectable,
  token,
} from "@db21/toolkit/feature-kit";
import {
  type EmptySurfaceProps,
  FeatureKitProvider,
  RenderSurface,
  type RenderSurfaceProps,
  Surface,
} from "@db21/toolkit/feature-kit/react";
import React from "react";
import { renderToString } from "react-dom/server";
import { expect, expectTypeOf, test } from "vitest";

// eslint-disable-next-line no-restricted-imports -- Existing validation test uses internal runtime; public rendering replacement deferred by test policy.
import { ReactRuntime } from "../../../src/feature-kit/react/react-runtime.js";
import {
  createModule,
  renderWithFeatureKit,
} from "./feature-kit-provider-test-helpers.js";

// eslint-disable-next-line db21-tests/require-justification -- Risk: invalid Surface classes fail after registration with unclear rendering errors; Contract: @Surface rejects classes without a render method.
test("@Surface() registration enforces runtime constructor contracts", () => {
  class MissingRenderSurface {
    public marker = true;
  }

  expect(() => {
    Surface()(MissingRenderSurface as never);
  }).toThrow("Cannot register a Surface class without a render method.");
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: a Surface resolves dependencies from an ambiguous module owner; Contract: existing kernel validation rejects duplicate Surface ownership before any render boundary.
test("React runtime rejects duplicate Surface owners", () => {
  @Surface()
  class SharedSurface {
    public render(_props: EmptySurfaceProps): React.ReactElement {
      return <p>shared</p>;
    }
  }

  const firstOwner = createModule({ surfaces: [SharedSurface] });
  const secondOwner = createModule({ surfaces: [SharedSurface] });

  const rootModule = createModule({
    imports: [firstOwner, secondOwner],
  });

  const app = Application.create(rootModule);

  expect(() => ReactRuntime.forApplication(app)).toThrow("multiple owners");
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: arbitrary undecorated classes are constructed as trusted Surfaces; Contract: existing kernel validation rejects invalid Surface registrations before any render boundary.
test("React runtime rejects undecorated Surface registrations", () => {
  class UndecoratedSurface {
    public render(_props: EmptySurfaceProps): React.ReactElement {
      return <p>undecorated</p>;
    }
  }

  // Invalid metadata intentionally bypasses the public ModuleMetadata typing.
  const badMetadata = {
    surfaces: [UndecoratedSurface],
  } as never;
  const badModule = createModule(badMetadata);
  const app = Application.create(badModule);

  expect(() => ReactRuntime.forApplication(app)).toThrow(
    "invalid surface registration",
  );
});

@Surface()
class ZeroSurface {
  public render(_props: EmptySurfaceProps): React.ReactElement {
    return <p>zero</p>;
  }
}

@Surface()
class LabeledSurface {
  public render(props: { showLabel: boolean }): React.ReactElement {
    return <p>{props.showLabel ? "label" : "hidden"}</p>;
  }
}

@Surface({ resolution: "sync" })
class SynchronousSurface {
  public render(_props: EmptySurfaceProps): React.ReactElement {
    return <p>synchronous</p>;
  }
}

@Surface({ resolution: "direct" })
class DirectSurface {
  public render(_props: EmptySurfaceProps): React.ReactElement {
    return <p>direct</p>;
  }
}

// Ensure RenderSurface infers nested render props, including required `showLabel`.
type LabeledSurfaceRenderProps = RenderSurfaceProps<typeof LabeledSurface>;

// Ensure RenderSurface infers nested render props for zero-input surfaces.
type ZeroSurfaceRenderProps = RenderSurfaceProps<typeof ZeroSurface>;

type ExpectedLabeledSurfaceRenderProps = Readonly<{
  surface: typeof LabeledSurface;
  props: { showLabel: boolean };
}>;

type ExpectedZeroSurfaceRenderProps = Readonly<{
  surface: typeof ZeroSurface;
  props?: undefined;
}>;

/** Compile-only fixture for the direct Surface constructor restriction. */
export const directSurfaceConstructorTypeFixture = (): void => {
  /** Invalid direct Surface fixture with an injected constructor dependency. */
  class DirectSurfaceWithDependency {
    /**
     * Stores the intentionally unsupported constructor dependency.
     *
     * @param value - The intentionally injected value.
     */
    public constructor(private readonly value: string) {}

    /**
     * Supplies a render member so the fixture only violates constructor injection.
     *
     * @param _props - The unused Surface props.
     * @returns The rendered fixture content.
     */
    public render(_props: EmptySurfaceProps): React.ReactElement {
      return <p>{this.value}</p>;
    }
  }

  // @ts-expect-error -- Direct Surfaces cannot declare constructor dependencies.
  Surface({ resolution: "direct" })(DirectSurfaceWithDependency);
};

// Ensure RenderSurface infers nested render props and exact surface prop shapes.
// eslint-disable-next-line db21-tests/require-justification -- Risk: callers can omit required nested Surface props or pass invalid values; Contract: RenderSurfaceProps enforces each registered Surface's exact nested prop shape at compile time.
test("RenderSurfaceProps requires surface-specific nested props with exact shape", () => {
  expectTypeOf<LabeledSurfaceRenderProps>().toExtend<ExpectedLabeledSurfaceRenderProps>();
  expectTypeOf<ExpectedLabeledSurfaceRenderProps>().toExtend<LabeledSurfaceRenderProps>();
  expectTypeOf<ZeroSurfaceRenderProps>().toExtend<ExpectedZeroSurfaceRenderProps>();
  expectTypeOf<ExpectedZeroSurfaceRenderProps>().toExtend<ZeroSurfaceRenderProps>();

  const validLabeledSurfaceProps = {
    surface: LabeledSurface,
    props: {
      showLabel: true,
    },
  } satisfies LabeledSurfaceRenderProps;

  const validZeroSurfaceProps = {
    surface: ZeroSurface,
  } satisfies ZeroSurfaceRenderProps;

  const validZeroSurfacePropsWithUndefined = {
    surface: ZeroSurface,
    props: undefined,
  } satisfies ZeroSurfaceRenderProps;

  const invalidMissingLabeledSurfaceProps = {
    surface: LabeledSurface,
    // @ts-expect-error -- `showLabel` is required for one-input surfaces.
  } satisfies LabeledSurfaceRenderProps;

  const invalidShowLabelTypeLabeledSurfaceProps = {
    surface: LabeledSurface,
    props: {
      // @ts-expect-error -- `showLabel` requires boolean.
      showLabel: "true",
    },
  } satisfies LabeledSurfaceRenderProps;

  const invalidZeroSurfaceProps = {
    surface: ZeroSurface,
    // @ts-expect-error -- Zero-input surfaces cannot receive nested `props`.
    props: {},
  } satisfies ZeroSurfaceRenderProps;

  expectTypeOf(validLabeledSurfaceProps).toExtend<LabeledSurfaceRenderProps>();
  expectTypeOf(validZeroSurfaceProps).toExtend<ZeroSurfaceRenderProps>();
  expectTypeOf(
    validZeroSurfacePropsWithUndefined,
  ).toExtend<ZeroSurfaceRenderProps>();
  expectTypeOf(
    invalidMissingLabeledSurfaceProps,
  ).not.toExtend<LabeledSurfaceRenderProps>();
  expectTypeOf(
    invalidShowLabelTypeLabeledSurfaceProps,
  ).not.toExtend<LabeledSurfaceRenderProps>();
  expectTypeOf(invalidZeroSurfaceProps).not.toExtend<ZeroSurfaceRenderProps>();
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: owner-scoped Surfaces fail to receive required nested props during SSR; Contract: SSR renders registered zero-input and required-prop Surfaces through their owner.
test("<RenderSurface /> renders owner-scoped surfaces with and without nested props", async () => {
  const module = createModule({ surfaces: [LabeledSurface, ZeroSurface] });
  const app = Application.create(module);

  const html = await renderWithFeatureKit(
    <FeatureKitProvider application={app}>
      <RenderSurface surface={ZeroSurface} />
      <RenderSurface surface={LabeledSurface} props={{ showLabel: true }} />
    </FeatureKitProvider>,
  );

  expect(html).toContain("zero");
  expect(html).toContain("label");
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: synchronous Surface rendering shows a loading fallback despite no asynchronous dependency; Contract: SSR emits the Surface without its configured fallback.
test("<RenderSurface /> renders synchronous surfaces without fallback", () => {
  const module = createModule({
    surfaces: [SynchronousSurface],
  });
  const app = Application.create(module);

  const html = renderToString(
    <FeatureKitProvider application={app} fallback={<p>loading</p>}>
      <RenderSurface surface={SynchronousSurface} />
    </FeatureKitProvider>,
  );

  expect(html).toContain("synchronous");
  expect(html).not.toContain("loading");
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: dependency-free migration Surfaces require an application provider; Contract: a direct Surface renders through the public component without a provider.
test("<RenderSurface /> renders direct surfaces without a provider", () => {
  const html = renderToString(<RenderSurface surface={DirectSurface} />);

  expect(html).toContain("direct");
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: direct Surfaces acquire module ownership despite bypassing DI; Contract: existing kernel validation rejects direct Surface module registration before any render boundary.
test("direct Surfaces reject module registration", () => {
  const module = createModule({ surfaces: [DirectSurface] });
  const app = Application.create(module);

  expect(() => ReactRuntime.forApplication(app)).toThrow(
    "must not be registered in module metadata",
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: a synchronous Surface silently suspends on an asynchronous dependency; Contract: SSR rejects the incompatible dependency resolution.
test("synchronous Surface rejects asynchronous dependencies", async () => {
  const payloadToken = token<string>("sync-surface-async-payload");

  @Surface({ resolution: "sync" })
  class InvalidSynchronousSurface {
    public constructor(
      @Inject(payloadToken) private readonly payload: string,
    ) {}

    public render(_props: EmptySurfaceProps): React.ReactElement {
      return <p>{this.payload}</p>;
    }
  }

  const module = createModule({
    configure: ({ bind }) => {
      bind(payloadToken).toResolvedValue(async () => {
        await Promise.resolve();

        return "payload";
      });
    },
    surfaces: [InvalidSynchronousSurface],
  });
  const app = Application.create(module);

  await expect(
    renderWithFeatureKit(
      <FeatureKitProvider application={app}>
        <RenderSurface surface={InvalidSynchronousSurface} />
      </FeatureKitProvider>,
    ),
  ).rejects.toThrow();
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: managed Surfaces render without application ownership or explicit registration; Contract: SSR rejects use outside the provider and unregistered Surfaces.
test("<RenderSurface /> rejects usage outside provider and for unregistered surfaces", async () => {
  await expect(
    renderWithFeatureKit(
      <RenderSurface surface={LabeledSurface} props={{ showLabel: true }} />,
    ),
  ).rejects.toThrow("outside a FeatureKitProvider");

  @Surface()
  class UnregisteredSurface {
    public render(_props: EmptySurfaceProps): React.ReactElement {
      return <p>unregistered</p>;
    }
  }

  const app = Application.create(createModule({}));

  await expect(
    renderWithFeatureKit(
      <FeatureKitProvider application={app}>
        <RenderSurface surface={UnregisteredSurface} />
      </FeatureKitProvider>,
    ),
  ).rejects.toThrow(
    `Surface "${UnregisteredSurface.name}" is not registered for this application.`,
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: asynchronous Surface construction repeats across SSR requests and duplicates stateful initialization; Contract: SSR renders resolved output while the application reuses its singleton construction.
test("Surface async dependency construction uses FeatureKitProvider async rendering", async () => {
  const payloadToken = token<string>("async-payload");
  let allowResolution = false;
  let constructCount = 0;

  @Injectable()
  class SurfaceDependencies {
    public constructor(@Inject(payloadToken) public readonly payload: string) {}
  }

  @Surface()
  class AsyncSurface {
    public constructor(
      @Inject(SurfaceDependencies) private readonly deps: SurfaceDependencies,
    ) {
      constructCount += 1;
    }

    public render(_props: EmptySurfaceProps): React.ReactElement {
      return <p>{this.deps.payload}</p>;
    }
  }

  const module = createModule({
    configure: ({ bind }) => {
      bind(payloadToken)
        .toResolvedValue(async () => {
          while (!allowResolution) {
            await Promise.resolve();
          }

          return "payload-ready";
        })
        .inSingletonScope();
      bind(SurfaceDependencies).toSelf().inSingletonScope();
    },
    surfaces: [AsyncSurface],
  });

  const app = Application.create(module);
  const firstMount = renderWithFeatureKit(
    <FeatureKitProvider application={app} fallback={<p>loading</p>}>
      <RenderSurface surface={AsyncSurface} />
    </FeatureKitProvider>,
  );

  allowResolution = true;

  const firstHtml = await firstMount;
  const secondHtml = await renderWithFeatureKit(
    <FeatureKitProvider application={app}>
      <RenderSurface surface={AsyncSurface} />
    </FeatureKitProvider>,
  );

  expect(firstHtml).toContain("payload-ready");
  expect(secondHtml).toContain("payload-ready");
  expect(constructCount).toBe(1);
});
