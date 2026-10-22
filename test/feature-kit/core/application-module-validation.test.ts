import "reflect-metadata";

import {
  Application,
  getTokenName,
  Module,
  token,
} from "@db21/toolkit/feature-kit";
import { test } from "vitest";

import {
  createModule,
  expectFeatureKitErrorFrom,
  expectNativeErrorFrom,
  resolveFromModule,
} from "./test-helpers.js";

// eslint-disable-next-line db21-tests/require-justification -- Module declarations must reject unowned exports and undecorated types before building a container graph.
test("module export must be local-owned and undecorated modules are rejected", async () => {
  const localToken = token<string>("unowned-token");

  @Module({
    exports: [localToken],
  })
  class InvalidExportModule {}

  await expectFeatureKitErrorFrom(
    () => Application.create(InvalidExportModule),
    "module_export_not_owned",
    getTokenName(localToken),
  );

  // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Empty class identity is the test subject for undecorated-module validation.
  class ImportedUndecorated {}

  @Module({
    imports: [ImportedUndecorated],
  })
  class RootWithUndecoratedImport {}

  await expectFeatureKitErrorFrom(
    () => Application.create(RootWithUndecoratedImport),
    "undecorated_module",
  );

  // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Empty class identity is the test subject for undecorated-module validation.
  class UndecoratedRootModule {}

  await expectFeatureKitErrorFrom(
    () => Application.create(UndecoratedRootModule),
    "undecorated_module",
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Import cycles must fail deterministically with a path developers can use to repair ownership.
test("decorated module import cycles are rejected with readable path", async () => {
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Empty class identity is the test subject; decorators are applied imperatively to trigger cycle metadata.
  class FirstModule {}

  // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Empty class identity is the test subject; decorators are applied imperatively for the cycle fixture.
  class SecondModule {}

  Module({
    imports: [SecondModule],
  })(FirstModule);
  Module({
    imports: [FirstModule],
  })(SecondModule);

  await expectFeatureKitErrorFrom(
    () => Application.create(FirstModule),
    "module_import_cycle",
    `${FirstModule.name} -> ${SecondModule.name} -> ${FirstModule.name}`,
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Private bindings must remain inaccessible to importing modules unless deliberately exported.
test("private imported bindings are inaccessible without explicit export", async () => {
  const privateToken = token<number>("private-import-token");

  const hiddenModule = createModule({
    configure: ({ bind }) => {
      bind(privateToken).toConstantValue(11);
    },
  });

  const rootModule = createModule({
    imports: [hiddenModule],
  });

  const app = Application.create(rootModule);

  await expectNativeErrorFrom(() =>
    resolveFromModule(app, rootModule, privateToken),
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Ambiguous exported bindings must retain native diagnostics instead of silently selecting an unsafe provider.
test("ambiguous bindings across direct imports and local/imported collisions surface native Inversify failures", async () => {
  const ambiguousToken = token<number>("ambiguous-token");
  const branchOneModule = createModule({
    exports: [ambiguousToken],
    configure: ({ bind }) => {
      bind(ambiguousToken).toConstantValue(1);
    },
  });

  const branchTwoModule = createModule({
    exports: [ambiguousToken],
    configure: ({ bind }) => {
      bind(ambiguousToken).toConstantValue(2);
    },
  });

  const directImportRoot = createModule({
    imports: [branchOneModule, branchTwoModule],
  });

  const directImportApp = Application.create(directImportRoot);

  await expectNativeErrorFrom(
    () => resolveFromModule(directImportApp, directImportRoot, ambiguousToken),
    "Ambiguous",
  );

  const collisionToken = token<number>("collision-token");
  const exportingModule = createModule({
    exports: [collisionToken],
    configure: ({ bind }) => {
      bind(collisionToken).toConstantValue(5);
    },
  });

  const localCollisionRoot = createModule({
    imports: [exportingModule],
    configure: ({ bind }) => {
      bind(collisionToken).toConstantValue(6);
    },
  });

  const localCollisionApp = Application.create(localCollisionRoot);

  await expectNativeErrorFrom(
    () =>
      resolveFromModule(localCollisionApp, localCollisionRoot, collisionToken),
    "Ambiguous",
  );
});
