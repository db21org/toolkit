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

import {
  expectFeatureKitErrorFrom,
  expectNativeErrorFrom,
} from "./test-helpers.js";

const createTestModule = (metadata: ModuleMetadata): ModuleType => {
  @Module(metadata)
  class ModuleFixture {}

  return ModuleFixture;
};

// eslint-disable-next-line db21-tests/require-justification -- Risk: transient construction can lose owner bindings or access imported private capabilities; Contract: instantiate resolves owner-private and explicitly exported imported dependencies.
test("ModuleContext.instantiate resolves owner-private and imported exported dependencies", async () => {
  const ownerPrivateToken = token<string>("owner-private-token");
  const importedExportedToken = token<string>("imported-exported-token");
  const importedPrivateToken = token<string>("imported-private-token");

  const importedModule = createTestModule({
    exports: [importedExportedToken],
    configure: ({ bind }) => {
      bind(importedExportedToken).toConstantValue("imported-exported");
      bind(importedPrivateToken).toConstantValue("imported-private");
    },
  });

  const rootModule = createTestModule({
    imports: [importedModule],
    configure: ({ bind }) => {
      bind(ownerPrivateToken).toConstantValue("owner-private");
    },
  });

  @Injectable()
  class ModuleContextConsumer {
    public constructor(
      @Inject(ownerPrivateToken) public readonly ownerValue: string,
      @Inject(importedExportedToken)
      public readonly importedValue: string,
    ) {}
  }

  const app = Application.create(rootModule);
  const rootContext = app.select(rootModule);

  const consumer = await rootContext.instantiate(ModuleContextConsumer);

  expect(consumer.ownerValue).toBe("owner-private");
  expect(consumer.importedValue).toBe("imported-exported");
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: synchronous consumers can receive unusable construction results for available constant dependencies; Contract: instantiateSync returns a constructed consumer with its injected value.
test("ModuleContext.instantiateSync resolves synchronous dependencies", () => {
  const payloadToken = token<string>("sync-payload");

  @Injectable()
  class SyncConsumer {
    public constructor(@Inject(payloadToken) public readonly payload: string) {}
  }

  const module = createTestModule({
    configure: ({ bind }) => {
      bind(payloadToken).toConstantValue("payload");
    },
  });
  const app = Application.create(module);

  const consumer = app.select(module).instantiateSync(SyncConsumer);

  expect(consumer.payload).toBe("payload");
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: synchronous consumers can receive unresolved asynchronous dependencies as invalid values; Contract: instantiateSync throws when a dependency resolves asynchronously.
test("ModuleContext.instantiateSync rejects asynchronous dependencies", () => {
  const payloadToken = token<string>("async-payload");

  @Injectable()
  class AsyncConsumer {
    public constructor(@Inject(payloadToken) public readonly payload: string) {}
  }

  const module = createTestModule({
    configure: ({ bind }) => {
      bind(payloadToken).toResolvedValue(async () => {
        await Promise.resolve();

        return "payload";
      });
    },
  });
  const app = Application.create(module);

  expect(() => app.select(module).instantiateSync(AsyncConsumer)).toThrow();
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: dynamic instantiation can bypass imported-module export boundaries and expose private bindings; Contract: instantiate rejects a consumer requiring a non-exported imported token.
test("ModuleContext.instantiate cannot use non-exported imported bindings", async () => {
  const exportedFromImport = token<string>("imported-exported-token");
  const privateFromImport = token<string>("imported-private-token");

  const importedModule = createTestModule({
    exports: [exportedFromImport],
    configure: ({ bind }) => {
      bind(exportedFromImport).toConstantValue("imported-exported");
      bind(privateFromImport).toConstantValue("imported-private");
    },
  });

  const rootModule = createTestModule({
    imports: [importedModule],
  });

  @Injectable()
  class RequiresPrivateImport {
    public constructor(
      @Inject(privateFromImport)
      public readonly value: string,
    ) {}
  }

  const app = Application.create(rootModule);
  const rootContext = app.select(rootModule);

  await expectNativeErrorFrom(
    () => rootContext.instantiate(RequiresPrivateImport),
    "No bindings",
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: transient instances can complete during or after disposal and outlive their application; Contract: construction and later calls reject with application_disposed across the shutdown boundary.
test("ModuleContext.instantiate enforces disposal safety before, during, and after disposal", async () => {
  const asyncToken = token<string>("async-context-token");
  let release = false;

  @Injectable()
  class AsyncConsumer {
    public constructor(@Inject(asyncToken) public readonly value: string) {}
  }

  const rootModule = createTestModule({
    configure: ({ bind }) => {
      bind(asyncToken)
        .toResolvedValue(async () => {
          while (!release) {
            await Promise.resolve();
          }

          return "value";
        })
        .inSingletonScope();
    },
  });

  const app = Application.create(rootModule);
  const context = app.select(rootModule);

  const construction = context.instantiate(AsyncConsumer);
  const disposal = app.dispose();

  release = true;

  await expectFeatureKitErrorFrom(() => construction, "application_disposed");
  await expectFeatureKitErrorFrom(
    () => context.instantiate(AsyncConsumer),
    "application_disposed",
  );

  await disposal;

  await expectFeatureKitErrorFrom(
    () => context.instantiate(AsyncConsumer),
    "application_disposed",
  );
});
