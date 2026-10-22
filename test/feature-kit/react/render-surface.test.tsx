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
import { expect, test } from "vitest";

// eslint-disable-next-line no-restricted-imports -- Test the private runtime without exporting it publicly.
import { ReactRuntime } from "../../../src/feature-kit/react/react-runtime.js";
import {
  createModule,
  renderWithFeatureKit,
} from "./feature-kit-provider-test-helpers.js";

// eslint-disable-next-line db21-tests/require-justification -- Surface registration must reject classes that cannot render a valid React result.
test("@Surface() registration enforces runtime constructor contracts", () => {
  class MissingRenderSurface {
    public marker = true;
  }

  expect(() => {
    Surface()(MissingRenderSurface as never);
  }).toThrow("Cannot register a Surface class without a render method.");
});

// eslint-disable-next-line db21-tests/require-justification -- A Surface with multiple owners would resolve dependencies from an ambiguous module scope.
test("React runtime rejects duplicate surface owners", () => {
  @Surface()
  class SharedSurface {
    public render(_props: EmptySurfaceProps): React.ReactElement {
      return <p>shared</p>;
    }
  }

  const firstOwner = createModule({
    surfaces: [SharedSurface],
  });

  const secondOwner = createModule({
    surfaces: [SharedSurface],
  });

  const rootModule = createModule({
    imports: [firstOwner, secondOwner],
  });

  const app = Application.create(rootModule);

  expect(() => ReactRuntime.forApplication(app)).toThrow("multiple owners");
});

// eslint-disable-next-line db21-tests/require-justification -- Module metadata must not construct arbitrary undecorated classes as trusted Surfaces.
test("React runtime rejects undecorated surface registrations", () => {
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

// Ensure RenderSurface infers nested render props and exact surface prop shapes.
// eslint-disable-next-line db21-tests/require-justification -- RenderSurface type contracts prevent callers from omitting required or passing invalid nested props.
test("RenderSurfaceProps requires surface-specific nested props with exact shape", () => {
  const assertLabeledSurfaceProps = (
    props: LabeledSurfaceRenderProps,
  ): void => {
    expect(props.surface.name).toBe("LabeledSurface");
  };

  const assertZeroSurfaceProps = (props: ZeroSurfaceRenderProps): void => {
    expect(props.surface.name).toBe("ZeroSurface");
  };

  const validLabeledSurfaceProps: LabeledSurfaceRenderProps = {
    surface: LabeledSurface,
    props: {
      showLabel: true,
    },
  };

  const validZeroSurfaceProps: ZeroSurfaceRenderProps = {
    surface: ZeroSurface,
  };

  const validZeroSurfacePropsWithUndefined: ZeroSurfaceRenderProps = {
    surface: ZeroSurface,
    props: undefined,
  };

  assertLabeledSurfaceProps(validLabeledSurfaceProps);
  assertZeroSurfaceProps(validZeroSurfaceProps);
  assertZeroSurfaceProps(validZeroSurfacePropsWithUndefined);

  // @ts-expect-error -- `showLabel` is required for one-input surfaces.
  const invalidMissingLabeledSurfaceProps: LabeledSurfaceRenderProps = {
    surface: LabeledSurface,
  };

  const invalidShowLabelTypeLabeledSurfaceProps: LabeledSurfaceRenderProps = {
    surface: LabeledSurface,
    props: {
      // @ts-expect-error -- `showLabel` requires boolean.
      showLabel: "true",
    },
  };

  const invalidZeroSurfaceProps: ZeroSurfaceRenderProps = {
    surface: ZeroSurface,
    // @ts-expect-error -- Zero-input surfaces cannot receive nested `props`.
    props: {},
  };

  expect(invalidMissingLabeledSurfaceProps).toBeDefined();
  expect(invalidShowLabelTypeLabeledSurfaceProps).toBeDefined();
  expect(invalidZeroSurfaceProps).toBeDefined();
});

// eslint-disable-next-line db21-tests/require-justification -- Managed Surfaces must resolve from their owner whether they accept no props or required nested props.
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

// eslint-disable-next-line db21-tests/require-justification -- Sync Surfaces must render without Suspense fallback when all construction dependencies are synchronous.
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

// eslint-disable-next-line db21-tests/require-justification -- Direct Surfaces support dependency-free rendering outside an application provider during migration.
test("<RenderSurface /> renders direct surfaces without a provider", () => {
  const html = renderToString(<RenderSurface surface={DirectSurface} />);

  expect(html).toContain("direct");
});

// eslint-disable-next-line db21-tests/require-justification -- Direct Surfaces bypass DI and therefore cannot accept dependencies or be registered in a module.
test("direct Surfaces reject constructor dependencies and module registration", () => {
  class DirectSurfaceWithDependency {
    public constructor(private readonly value: string) {}

    public render(_props: EmptySurfaceProps): React.ReactElement {
      return <p>{this.value}</p>;
    }
  }

  const assertConstructorContract = (): void => {
    // @ts-expect-error -- Direct Surfaces cannot declare constructor dependencies.
    Surface({ resolution: "direct" })(DirectSurfaceWithDependency);
  };

  expect(assertConstructorContract).toBeTypeOf("function");

  const module = createModule({ surfaces: [DirectSurface] });
  const app = Application.create(module);

  expect(() => ReactRuntime.forApplication(app)).toThrow(
    "must not be registered in module metadata",
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Sync Surface rendering must reject asynchronous dependencies rather than silently suspending.
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

// eslint-disable-next-line db21-tests/require-justification -- Managed Surfaces require both a provider runtime and an explicit application registration.
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

// eslint-disable-next-line db21-tests/require-justification -- Asynchronous Surface construction must suspend once and reuse the constructed instance across renders.
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
