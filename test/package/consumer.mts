import commonConfig from "@db21/toolkit/eslint";
import astroConfig from "@db21/toolkit/eslint/astro";
import { recommended } from "@db21/toolkit/eslint/base";
import { createExpoConfig } from "@db21/toolkit/eslint/expo";
import * as graphqlConventions from "@db21/toolkit/eslint/expo/graphql-conventions";
import { createNestConfig } from "@db21/toolkit/eslint/nest";
import * as plugins from "@db21/toolkit/eslint/plugins";
import reactConfig from "@db21/toolkit/eslint/react";
import {
  createRegistry,
  defineEvent,
  type EventRegistry,
} from "@db21/toolkit/events";
import {
  Application,
  Module,
  type ModuleMetadata,
} from "@db21/toolkit/feature-kit";
import { createCoreDependencyCruiserConfig } from "@db21/toolkit/feature-kit/conventions/core/dependency-cruiser";
import { createCoreEslintConfig } from "@db21/toolkit/feature-kit/conventions/core/eslint";
import { createNestjsDependencyCruiserConfig } from "@db21/toolkit/feature-kit/conventions/nestjs/dependency-cruiser";
import { createNestjsEslintConfig } from "@db21/toolkit/feature-kit/conventions/nestjs/eslint";
import { createReactDependencyCruiserConfig } from "@db21/toolkit/feature-kit/conventions/react/dependency-cruiser";
import { createReactEslintConfig } from "@db21/toolkit/feature-kit/conventions/react/eslint";
import { reactProvider } from "@db21/toolkit/feature-kit/react";
import { createMoney, type Money } from "@db21/toolkit/money";
import { isDefined, type Maybe } from "@db21/toolkit/utils";
import { z } from "zod";

const itemCreated = defineEvent(
  "itemCreated",
  "item.created",
  1,
  z.object({ itemId: z.string() }),
);

export const eventRegistry: EventRegistry<readonly [typeof itemCreated]> =
  createRegistry([itemCreated]);
export const event = eventRegistry.createEvent(
  eventRegistry.eventTypes.itemCreated,
  {
    eventId: "4423fb0f-848d-4e34-a71f-01b609b1e7cf",
    occurredAt: "2026-08-21T12:00:00.000Z",
    itemId: "item-1",
  },
);
export const itemId: string = event.itemId;
// @ts-expect-error Unknown routing keys must not be accepted.
eventRegistry.safeParseEvent("unknown", {});
// @ts-expect-error Payload fields remain required in consumer declarations.
eventRegistry.createEvent("item.created", { eventId: "id", occurredAt: "now" });

export const metadata: ModuleMetadata = {
  reactProviders: [
    reactProvider({ dependencies: {}, component: ({ children }) => children }),
  ],
};

/**
 *
 */
@Module(metadata)
/** Consumer fixture exercising the packaged module decorator. */
export class ConsumerModule {}

export const application = Application.create(ConsumerModule);
export const money: Maybe<Money> = createMoney("12.34", "USD") ?? null;
export const defined: boolean = isDefined(money);
export const expoOptions: Parameters<typeof createExpoConfig>[0] = {
  cwd: ".",
  sourceRoot: "lib",
  moduleRoots: ["lib/domains"],
  allowedFolders: ["services"],
  additionalRoles: [],
  graphql: { graphqlDirectory: "documents", documentExtensions: ["graphql"] },
};
export const nestOptions: Parameters<typeof createNestConfig>[0] = {
  cwd: ".",
  sourceRoot: "lib",
  moduleRoots: ["lib/domains"],
  additionalRoles: [],
  utilityExemptPaths: [],
};
export const scalarMappings: graphqlConventions.GraphqlScalarMappings = {
  UUID: "string",
};
export const unmappedScalars: string[] =
  graphqlConventions.collectUnmappedCustomScalars(
    "scalar UUID",
    scalarMappings,
  );
export const publicEntries = [
  recommended,
  commonConfig,
  reactConfig,
  astroConfig,
  createExpoConfig,
  createNestConfig,
  plugins,
  graphqlConventions,
  createCoreEslintConfig,
  createCoreDependencyCruiserConfig,
  createReactEslintConfig,
  createReactDependencyCruiserConfig,
  createNestjsEslintConfig,
  createNestjsDependencyCruiserConfig,
];
