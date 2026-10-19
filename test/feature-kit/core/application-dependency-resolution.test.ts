import "reflect-metadata";

import {
  Application,
  Inject,
  Injectable,
  Module,
  type ModuleMetadata,
  type ModuleType,
  token,
} from "@db21/toolkit/feature-kit";
import { expect, test } from "vitest";

import { resolveFromModule } from "./test-helpers.js";

const createTestModule = (metadata: ModuleMetadata): ModuleType => {
  @Module(metadata)
  class ModuleFixture {}

  return ModuleFixture;
};

test("class identifiers and branded tokens resolve through constructor injection", async () => {
  const configToken = token<number>("config-value");
  const infoToken = token<{ readonly label: string }>("service-info");
  const serviceNameToken = token<string>("service-name");

  @Injectable()
  class Dependency {
    public constructor(
      @Inject(configToken)
      public readonly config: number,
      @Inject(infoToken)
      public readonly info: { readonly label: string },
      @Inject(serviceNameToken)
      public readonly serviceName: string,
    ) {}
  }

  @Injectable()
  class Consumer {
    public constructor(
      @Inject(Dependency) public readonly dependency: Dependency,
    ) {}
  }

  const module = createTestModule({
    configure: ({ bind }) => {
      bind(configToken).toConstantValue(2);
      bind(infoToken).toConstantValue({ label: "alpha" });
      bind(serviceNameToken).toConstantValue("primary");
      bind(Dependency).toSelf().inSingletonScope();
      bind(Consumer).toSelf().inSingletonScope();
    },
  });

  const app = Application.create(module);
  const firstConsumer = await resolveFromModule(app, module, Consumer);
  const secondConsumer = await resolveFromModule(app, module, Consumer);
  const config = await resolveFromModule(app, module, configToken);
  const info = await resolveFromModule(app, module, infoToken);
  const serviceName = await resolveFromModule(app, module, serviceNameToken);

  expect(firstConsumer).toBe(secondConsumer);
  expect(firstConsumer.dependency.config).toBe(config);
  expect(firstConsumer.dependency.config).toBe(2);
  expect(firstConsumer.dependency.info).toBe(info);
  expect(firstConsumer.dependency.info.label).toBe("alpha");
  expect(firstConsumer.dependency.serviceName).toBe(serviceName);
  expect(serviceName).toBe("primary");
});

test("async dependency chains resolve across module boundaries", async () => {
  const firstToken = token<string>("boundary-first");
  const secondToken = token<string>("boundary-second");
  const rootToken = token<string>("boundary-root");
  const order: string[] = [];

  const firstModule = createTestModule({
    exports: [firstToken],
    configure: ({ bind }) => {
      bind(firstToken).toResolvedValue(() => {
        order.push("first");

        return "first";
      });
    },
  });

  const secondModule = createTestModule({
    imports: [firstModule],
    exports: [secondToken],
    configure: ({ bind }) => {
      bind(secondToken).toResolvedValue(
        (value: string) => {
          order.push("second");

          return `${value}-second`;
        },
        [firstToken],
      );
    },
  });

  const rootModule = createTestModule({
    imports: [secondModule],
    exports: [rootToken],
    configure: ({ bind }) => {
      bind(rootToken).toResolvedValue(
        (value: string) => {
          order.push("root");

          return `${value}-root`;
        },
        [secondToken],
      );
    },
  });

  const app = Application.create(rootModule);
  const resolved = await resolveFromModule(app, rootModule, rootToken);

  expect(resolved).toEqual("first-second-root");
  expect(order).toEqual(["first", "second", "root"]);
});

test("duplicate token descriptions keep distinct identities", async () => {
  const firstToken = token<number>("duplicate-description");
  const secondToken = token<number>("duplicate-description");

  const module = createTestModule({
    configure: ({ bind }) => {
      bind(firstToken).toConstantValue(1);
      bind(secondToken).toConstantValue(2);
    },
  });

  const app = Application.create(module);
  const firstValue = await resolveFromModule(app, module, firstToken);
  const secondValue = await resolveFromModule(app, module, secondToken);

  expect(firstToken).not.toBe(secondToken);
  expect(firstValue).toEqual(1);
  expect(secondValue).toEqual(2);
});

test("Application.prototype exposes the public instance API", () => {
  const prototypeKeys = Object.getOwnPropertyNames(
    Application.prototype,
  ).toSorted((left, right) => left.localeCompare(right));

  expect(prototypeKeys).toContain("assertActive");
  expect(prototypeKeys).toContain("constructor");
  expect(prototypeKeys).toContain("dispose");
  expect(prototypeKeys).toContain("modules");
  expect(prototypeKeys).toContain("resolve");
  expect(prototypeKeys).toContain("select");

  expect(prototypeKeys).not.toContain("attach");
  expect(prototypeKeys).not.toContain("get");
  expect(prototypeKeys).not.toContain("adapters");
});

test("public runtime exports stay limited to the intended API", async () => {
  const runtime = await import("@db21/toolkit/feature-kit");
  const keys = Object.keys(runtime).toSorted((left, right) =>
    left.localeCompare(right),
  );

  expect(keys).toEqual(
    [
      "Application",
      "FeatureKitError",

      "Inject",
      "Injectable",
      "Module",
      "PostConstruct",
      "PreDestroy",
      "getTokenName",
      "inspectModule",
      "token",
    ].toSorted((left, right) => left.localeCompare(right)),
  );

  expect("resolveFromModule" in runtime).toBe(false);
  expect("ModuleContext" in runtime).toBe(false);
  expect("TokenValue" in runtime).toBe(false);
  expect("adapters" in runtime).toBe(false);
});
