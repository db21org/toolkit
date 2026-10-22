import "reflect-metadata";

import {
  Application,
  getTokenName,
  Injectable,
  type InjectionToken,
  Module,
  type ModuleMetadata,
  type ModuleType,
  token,
} from "@db21/toolkit/feature-kit";
import { expect, test } from "vitest";

import { expectNativeErrorFrom, resolveFromModule } from "./test-helpers.js";

type SharedModuleResult = {
  sharedService: object;
};

const createTestModule = (metadata: ModuleMetadata): ModuleType => {
  @Module(metadata)
  class ModuleFixture {}

  return ModuleFixture;
};

type SharedModuleGraphCounters = {
  sharedConfigureCount: number;
  sharedConstructCount: number;
  branchOneConfigureCount: number;
  branchTwoConfigureCount: number;
  rootConfigureCount: number;
};

type SharedModuleGraph = {
  app: ReturnType<typeof Application.create>;
  counters: SharedModuleGraphCounters;
  sharedToken: ReturnType<typeof token<string>>;
  branchOneResultToken: ReturnType<typeof token<SharedModuleResult>>;
  branchTwoResultToken: ReturnType<typeof token<SharedModuleResult>>;
  sharedServiceToken: ModuleType;
  rootModule: ModuleType;
};

type SharedModuleToken = InjectionToken<SharedModuleResult>;

const createBranchModule = (
  sharedModule: ModuleType,
  sharedServiceToken: InjectionToken<object>,
  exportToken: SharedModuleToken,
  initial: SharedModuleGraphCounters,
  count: "branchOneConfigureCount" | "branchTwoConfigureCount",
): ModuleType =>
  createTestModule({
    imports: [sharedModule],
    exports: [exportToken],
    configure: ({ bind }) => {
      initial[count] += 1;
      bind(exportToken).toResolvedValue(
        (sharedService: object) => ({ sharedService }),
        [sharedServiceToken],
      );
    },
  });

const createSharedModuleGraph = (): SharedModuleGraph => {
  const initial: SharedModuleGraphCounters = {
    sharedConfigureCount: 0,
    sharedConstructCount: 0,
    branchOneConfigureCount: 0,
    branchTwoConfigureCount: 0,
    rootConfigureCount: 0,
  };

  @Injectable()
  class SharedService {
    public constructor() {
      initial.sharedConstructCount += 1;
    }
  }

  const sharedToken = token<string>("shared-identity");
  const branchOneResultToken = token<SharedModuleResult>("branch-one");
  const branchTwoResultToken = token<SharedModuleResult>("branch-two");
  const sharedModule = createTestModule({
    exports: [SharedService],
    configure: ({ bind }) => {
      initial.sharedConfigureCount += 1;
      bind(SharedService).toSelf().inSingletonScope();
    },
  });

  const branchOneModule = createBranchModule(
    sharedModule,
    SharedService,
    branchOneResultToken,
    initial,
    "branchOneConfigureCount",
  );

  const branchTwoModule = createBranchModule(
    sharedModule,
    SharedService,
    branchTwoResultToken,
    initial,
    "branchTwoConfigureCount",
  );

  const rootModule = createTestModule({
    imports: [sharedModule, branchOneModule, branchTwoModule],
    configure: ({ bind }) => {
      initial.rootConfigureCount += 1;
      bind(sharedToken).toResolvedValue(() => getTokenName(SharedService));
    },
  });

  const app = Application.create(rootModule);

  return {
    app,
    counters: initial,
    sharedToken,
    branchOneResultToken,
    branchTwoResultToken,
    sharedServiceToken: SharedService,
    rootModule,
  };
};

// eslint-disable-next-line db21-tests/require-justification -- Constructing an application must not eagerly instantiate providers with side effects.
test("Application.create is synchronous and registrations are lazy", () => {
  let constructCount = 0;

  @Injectable()
  class RootService {
    public constructor() {
      constructCount += 1;
    }
  }

  const rootModule = createTestModule({
    configure: ({ bind }) => {
      bind(RootService).toSelf().inSingletonScope();
    },
  });

  const app = Application.create(rootModule);

  expect(app).toBeDefined();
  expect(constructCount).toBe(0);
});

// eslint-disable-next-line db21-tests/require-justification -- Nested modules must compose only declared exports to preserve module ownership boundaries.
test("recursive imports expose direct exports while hiding un-exported bindings", async () => {
  const leafToken = token<number>("leaf-value");
  const middleToken = token<string>("middle-value");
  const rootToken = token<string>("root-derived-value");

  const leafModule = createTestModule({
    exports: [leafToken],
    configure: ({ bind }) => {
      bind(leafToken).toResolvedValue(() => 1);
    },
  });

  const middleModule = createTestModule({
    imports: [leafModule],
    exports: [middleToken],
    configure: ({ bind }) => {
      bind(middleToken).toResolvedValue(
        (leafValue: number) => `${String(leafValue)}-middle`,
        [leafToken],
      );
    },
  });

  const rootModule = createTestModule({
    imports: [middleModule],
    exports: [rootToken],
    configure: ({ bind }) => {
      bind(rootToken).toResolvedValue(
        (middleValue: string) => `${middleValue}-root`,
        [middleToken],
      );
    },
  });

  const app = Application.create(rootModule);
  const rootValue = await resolveFromModule(app, rootModule, rootToken);

  expect(rootValue).toEqual("1-middle-root");
});

// eslint-disable-next-line db21-tests/require-justification -- Imports must not accidentally re-export transitive private capabilities to higher-level modules.
test("exports are not transitive across module boundaries", async () => {
  const leafToken = token<number>("non-transitive-leaf");
  const middleToken = token<number>("non-transitive-middle");

  const leafModule = createTestModule({
    exports: [leafToken],
    configure: ({ bind }) => {
      bind(leafToken).toConstantValue(21);
    },
  });

  const middleModule = createTestModule({
    imports: [leafModule],
    exports: [middleToken],
    configure: ({ bind }) => {
      bind(middleToken).toResolvedValue(
        (leafValue: number) => leafValue * 2,
        [leafToken],
      );
    },
  });

  const rootModule = createTestModule({
    imports: [middleModule],
  });

  const app = Application.create(rootModule);
  const middleValue = await resolveFromModule(app, rootModule, middleToken);

  expect(middleValue).toBe(42);
  await expectNativeErrorFrom(
    () => resolveFromModule(app, rootModule, leafToken),
    "No bindings",
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Diamond imports must not duplicate configuration or singleton identity across feature branches.
test("shared modules are configured once and keep shared singleton identity", async () => {
  const graph = createSharedModuleGraph();

  const rootSharedIdentity = await resolveFromModule(
    graph.app,
    graph.rootModule,
    graph.sharedServiceToken,
  );

  const firstBranchValue = await resolveFromModule(
    graph.app,
    graph.rootModule,
    graph.branchOneResultToken,
  );

  const secondBranchValue = await resolveFromModule(
    graph.app,
    graph.rootModule,
    graph.branchTwoResultToken,
  );

  const rootSharedName = await resolveFromModule(
    graph.app,
    graph.rootModule,
    graph.sharedToken,
  );

  expect(graph.counters.sharedConfigureCount).toBe(1);
  expect(graph.counters.branchOneConfigureCount).toBe(1);
  expect(graph.counters.branchTwoConfigureCount).toBe(1);
  expect(graph.counters.rootConfigureCount).toBe(1);
  expect(graph.counters.sharedConstructCount).toBe(1);
  expect(firstBranchValue.sharedService).toBe(rootSharedIdentity);
  expect(secondBranchValue.sharedService).toBe(rootSharedIdentity);
  expect(rootSharedName).toBe("SharedService");
});
