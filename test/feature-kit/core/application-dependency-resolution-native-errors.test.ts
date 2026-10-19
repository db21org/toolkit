import "reflect-metadata";

import { Application } from "@db21/toolkit/feature-kit";
import { Injectable, token } from "@db21/toolkit/feature-kit";
import { test } from "vitest";

import {
  createModule,
  expectNativeErrorFrom,
  resolveFromModule,
} from "./test-helpers.js";

test("missing bindings, provider cycles, and activation failures stay native Inversify errors", async () => {
  const missingToken = token<number>("missing-token");
  const cycleA = token<number>("cycle-a");
  const cycleB = token<number>("cycle-b");

  @Injectable()
  class FailingActivation {
    public constructor() {
      throw new Error("activation failure");
    }
  }

  const missingModule = createModule({});
  const cycleModule = createModule({
    configure: ({ bind }) => {
      bind(cycleA).toResolvedValue((value: number) => value, [cycleB]);
      bind(cycleB).toResolvedValue((value: number) => value, [cycleA]);
      bind(FailingActivation).toSelf().inSingletonScope();
    },
  });

  const missingApp = Application.create(missingModule);
  const cycleApp = Application.create(cycleModule);

  await expectNativeErrorFrom(() =>
    resolveFromModule(missingApp, missingModule, missingToken),
  );
  await expectNativeErrorFrom(() =>
    resolveFromModule(cycleApp, cycleModule, cycleA),
  );
  await expectNativeErrorFrom(() =>
    resolveFromModule(cycleApp, cycleModule, FailingActivation),
  );
});
