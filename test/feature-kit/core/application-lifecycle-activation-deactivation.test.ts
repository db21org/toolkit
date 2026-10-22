import "reflect-metadata";

import {
  Application,
  Injectable,
  Module,
  type ModuleMetadata,
  type ModuleType,
  PostConstruct,
  PreDestroy,
  token,
} from "@db21/toolkit/feature-kit";
import { expect, test } from "vitest";

import { resolveFromModule } from "./test-helpers.js";

const createTestModule = (metadata: ModuleMetadata): ModuleType => {
  @Module(metadata)
  class ModuleFixture {}

  return ModuleFixture;
};

// eslint-disable-next-line db21-tests/require-justification -- Application disposal must invoke both decorator and explicit factory cleanup for owned singletons.
test("explicit factory onDeactivation cleanup runs during disposal", async () => {
  const ownedFactoryToken = token<{ destroy: () => void }>("factory-owned");
  const classDisposed: string[] = [];
  const factoryDisposed: string[] = [];

  @Injectable()
  class OwnedService {
    @PreDestroy()
    public destroy(): void {
      classDisposed.push("class");
    }
  }

  const module = createTestModule({
    configure: ({ bind }) => {
      bind(OwnedService).toSelf().inSingletonScope();
      bind(ownedFactoryToken)
        .toResolvedValue((): { destroy: () => void } => {
          return {
            destroy: (): void => {
              factoryDisposed.push("factory");
            },
          };
        })
        .inSingletonScope()
        .onDeactivation((value: unknown): void => {
          (value as { destroy: () => void }).destroy();
        });
    },
  });

  const app = Application.create(module);
  const firstService = await resolveFromModule(app, module, OwnedService);
  const secondService = await resolveFromModule(app, module, OwnedService);
  const firstFactory = await resolveFromModule(app, module, ownedFactoryToken);
  const secondFactory = await resolveFromModule(app, module, ownedFactoryToken);

  expect(firstService).toBe(secondService);
  expect(firstFactory).toBe(secondFactory);

  await app.dispose();

  expect(classDisposed).toEqual(["class"]);
  expect(factoryDisposed).toEqual(["factory"]);
});

// eslint-disable-next-line db21-tests/require-justification -- Asynchronous initialization and teardown must complete before services become usable or disposal resolves.
test("async PostConstruct and PreDestroy methods are honored", async () => {
  const initGate = createDeferredState();
  const destroyGate = createDeferredState();
  const lifecycleLog: string[] = [];

  @Injectable()
  class AsyncLifecycleService {
    @PostConstruct()
    public async init(): Promise<void> {
      await initGate.promise;
      lifecycleLog.push("initialized");
    }

    @PreDestroy()
    public async destroy(): Promise<void> {
      await destroyGate.promise;
      lifecycleLog.push("destroyed");
    }
  }

  const module = createTestModule({
    configure: ({ bind }) => {
      bind(AsyncLifecycleService).toSelf().inSingletonScope();
    },
  });

  const app = Application.create(module);
  const resolving = resolveFromModule(app, module, AsyncLifecycleService);

  await Promise.resolve();
  expect(lifecycleLog).toEqual([]);

  initGate.resolve();
  const resolvedService = await resolving;

  expect(resolvedService).toBeInstanceOf(AsyncLifecycleService);
  expect(lifecycleLog).toEqual(["initialized"]);

  const disposing = app.dispose();

  await Promise.resolve();
  expect(lifecycleLog).toEqual(["initialized"]);

  destroyGate.resolve();
  await disposing;

  expect(lifecycleLog).toEqual(["initialized", "destroyed"]);
});

// eslint-disable-next-line db21-tests/require-justification -- Dependents must release imported resources before their providers are torn down.
test("importer resources dispose before imported module resources", async () => {
  const lifecycleLog: string[] = [];

  @Injectable()
  class ImportedService {
    @PreDestroy()
    public destroy(): void {
      lifecycleLog.push("imported:destroyed");
    }
  }

  @Injectable()
  class RootService {
    @PreDestroy()
    public destroy(): void {
      lifecycleLog.push("root:destroyed");
    }
  }

  const importedModule = createTestModule({
    exports: [ImportedService],
    configure: ({ bind }) => {
      bind(ImportedService).toSelf().inSingletonScope();
    },
  });

  const rootModule = createTestModule({
    imports: [importedModule],
    configure: ({ bind }) => {
      bind(RootService).toSelf().inSingletonScope();
    },
  });

  const app = Application.create(rootModule);

  await resolveFromModule(app, rootModule, RootService);
  await resolveFromModule(app, rootModule, ImportedService);

  await app.dispose();

  expect(lifecycleLog).toEqual(["root:destroyed", "imported:destroyed"]);
});

const createDeferredState = (): {
  promise: Promise<void>;
  resolve: () => void;
} => {
  let resolve: () => void = () => {
    return;
  };

  const promise = new Promise<void>((resolveValue) => {
    resolve = resolveValue;
  });

  return { promise, resolve };
};
