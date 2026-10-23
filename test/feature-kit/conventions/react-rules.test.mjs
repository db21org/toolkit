import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createReactDependencyCruiserConfig } from "@db21/toolkit/feature-kit/conventions/react/dependency-cruiser";
import { createReactEslintConfig } from "@db21/toolkit/feature-kit/conventions/react/eslint";
import { ESLint } from "eslint";
import typescriptEslint from "typescript-eslint";
import { afterEach, test } from "vitest";

import { clearModuleDiscoveryCache } from "#feature-kit-config/module-discovery";

import { assertDependencyCruiserGraph } from "./dependency-cruiser-test-helpers.mjs";

const temporaryDirectories = [];

const createProject = () => {
  const cwd = mkdtempSync(join(tmpdir(), "feature-kit-react-rules-"));

  temporaryDirectories.push(cwd);

  return cwd;
};

const writeProjectFile = (cwd, path, content = "export {};\n") => {
  const filePath = join(cwd, path);

  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, content);
};

afterEach(() => {
  clearModuleDiscoveryCache();

  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

const setupCatalogModule = (cwd) => {
  writeProjectFile(
    cwd,
    "src/features/catalog/catalog.module.ts",
    "export class CatalogModule {}\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/index.ts",
    'export { CatalogModule } from "./catalog.module.js";\n',
  );
};

const reactEslintConfig = (cwd) => {
  const base = createReactEslintConfig({
    cwd,
    moduleRoots: ["src/features"],
  });

  return {
    ...base,
    languageOptions: {
      ...(base.languageOptions ?? {}),
      parser: typescriptEslint.parser,
      parserOptions: {
        ...(base.languageOptions?.parserOptions ?? {}),
        ecmaFeatures: { jsx: true },
        legacyDecorators: true,
      },
    },
  };
};

const createReactLinter = (cwd) =>
  new ESLint({
    cwd,
    ignore: false,
    overrideConfig: [reactEslintConfig(cwd)],
    overrideConfigFile: true,
  });

// eslint-disable-next-line db21-tests/require-justification -- Risk: data services can acquire UI dependencies, coupling server-safe logic to rendering infrastructure; Contract: dependency-cruiser accepts a query-to-service graph and rejects a service-to-component graph.
test("enforces render-focused role dependency contracts", async () => {
  const cwd = createProject();

  setupCatalogModule(cwd);

  for (const [path, source] of [
    ["services/catalog.service.ts"],
    ["queries/catalog.query.ts", 'import "../services/catalog.service.js";\n'],
    ["components/Catalog.tsx"],
    ["services/rejected.service.ts", 'import "../components/Catalog.js";\n'],
    ["presenters/Feed.ts"],
    ["views/Feed.ts"],
    [
      "services/compatible.service.ts",
      'import "../presenters/Feed.js";\nimport "../views/Feed.js";\n',
    ],
  ]) {
    writeProjectFile(cwd, `src/features/catalog/${path}`, source);
  }

  writeProjectFile(
    cwd,
    "tsconfig.json",
    '{ "compilerOptions": { "module": "NodeNext", "moduleResolution": "NodeNext" } }\n',
  );

  const config = createReactDependencyCruiserConfig({
    cwd,
    moduleRoots: ["src/features"],
    sourceRoot: "src",
    tsConfig: "tsconfig.json",
  });

  await assertDependencyCruiserGraph({
    allowed: [
      "src/features/catalog/queries/catalog.query.ts",
      "src/features/catalog/services/compatible.service.ts",
    ],
    config,
    cwd,
    rejected: [
      {
        file: "src/features/catalog/services/rejected.service.ts",
        rule: /feature-kit-react-src-features-catalog-services-avoid-ui/u,
      },
    ],
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: misplaced or undecorated Surface classes bypass discoverable render-wiring conventions; Contract: linting reports invalid decorated Surface filenames and locations but accepts an undecorated class.
test("validates Surface placement and decorator-backed filename boundaries", async () => {
  const cwd = createProject();

  setupCatalogModule(cwd);

  writeProjectFile(
    cwd,
    "src/features/catalog/surfaces/Feed.surface.tsx",
    "@Surface()\nexport class Feed {}\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/surfaces/FeedSurface.tsx",
    "@Surface()\nexport class FeedSurface {}\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/components/Feed.surface.tsx",
    "@Surface()\nexport class Feed {}\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/surfaces/nested/Feed.surface.tsx",
    "@Surface()\nexport class Feed {}\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/surfaces/NoDecorator.surface.tsx",
    "export class NoDecorator {}\n",
  );

  const eslint = createReactLinter(cwd);
  const results = await eslint.lintFiles(["src/**/*.tsx"]);
  const messages = results.flatMap((result) => result.messages);
  const surfaceFilenameMessages = messages.filter(
    (message) => message.ruleId === "feature-kit-react/surface-class-filename",
  );

  assert.equal(surfaceFilenameMessages.length, 3);

  const noDecoratorResult = results.find((result) =>
    result.filePath.endsWith("NoDecorator.surface.tsx"),
  );

  assert.equal(noDecoratorResult?.messages.length, 0);
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: Surface classes can bypass controlled DI and component boundaries through platform imports; Contract: linting reports each prohibited platform dependency while allowing supported feature wiring.
test("enforces Surface import boundaries and allows DI/component wiring", async () => {
  const cwd = createProject();

  setupCatalogModule(cwd);

  for (const [path, source] of [
    ["services/catalog.service.ts", "export class CatalogService {}\n"],
    [
      "contracts/CatalogContract.ts",
      "export type CatalogContract = { id: string };\n",
    ],
    [
      "components/CatalogSurfaceHost.tsx",
      "export const CatalogSurfaceHost = () => null;\n",
    ],
    ["hooks/use-catalog.hook.ts", "export const useCatalog = () => null;\n"],
    ["queries/catalog.query.ts", "export const catalogQuery = () => null;\n"],
    ["react-providers/App.react-provider.tsx", "reactProvider({});\n"],
  ]) {
    writeProjectFile(cwd, `src/features/catalog/${path}`, source);
  }

  writeProjectFile(
    cwd,
    "src/features/catalog/surfaces/Catalog.surface.tsx",
    'import { Surface } from "feature-kit-react";\n' +
      'import { CatalogService } from "../../../src/feature-kit/conventions/services/catalog.service.ts";\n' +
      'import { CatalogContract } from "../../../src/feature-kit/conventions/contracts/CatalogContract.ts";\n' +
      'import { CatalogSurfaceHost } from "../../../src/feature-kit/conventions/components/CatalogSurfaceHost.tsx";\n' +
      'import { useCatalog } from "../../../src/feature-kit/conventions/hooks/use-catalog.hook.ts";\n' +
      'import { catalogQuery } from "../../../src/feature-kit/conventions/queries/catalog.query.ts";\n' +
      'import { useTranslation } from "react-i18next";\n' +
      'import { Text } from "react-native";\n' +
      'import { Link } from "expo-router";\n' +
      'import { AppProvider } from "../../../src/feature-kit/conventions/react-providers/App.react-provider";\n' +
      "@Surface()\n" +
      "export class CatalogSurface {}\n",
  );

  const eslint = createReactLinter(cwd);
  const results = await eslint.lintFiles(["src/**/*.tsx", "src/**/*.ts"]);
  const messages = results.flatMap((result) => result.messages);
  const dependencyMessages = messages.filter(
    (message) => message.ruleId === "feature-kit-react/surface-dependencies",
  );

  assert.equal(dependencyMessages.length, 6);
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: treating unsupported presentation folders as framework roles rejects compatible consumer structures; Contract: linting leaves presenters and views free of role diagnostics.
test("does not enforce presenters, presentations, or views as framework roles", async () => {
  const cwd = createProject();

  setupCatalogModule(cwd);

  writeProjectFile(cwd, "src/features/catalog/presenters/Feed.ts");
  writeProjectFile(cwd, "src/features/catalog/presentation/Feed.ts");
  writeProjectFile(cwd, "src/features/catalog/presentations/Feed.ts");
  writeProjectFile(cwd, "src/features/catalog/views/feed-view.tsx");

  const eslint = createReactLinter(cwd);
  const results = await eslint.lintFiles(["src/**/*.{ts,tsx}"]);
  const messages = results.flatMap((result) => result.messages);

  for (const role of ["presenters", "presentation", "presentations", "views"]) {
    assert.equal(
      messages.some((message) => message.message.includes(`role "${role}"`)),
      false,
    );
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: component policy can block valid stateful and translated UI composition; Contract: linting accepts both hook-using and passive components.
test("allows both smart and dumb components with no passive-component restriction", async () => {
  const cwd = createProject();

  setupCatalogModule(cwd);

  writeProjectFile(
    cwd,
    "src/features/catalog/hooks/use-catalog.hook.ts",
    'import { useState } from "react";\nexport const useCatalog = () => useState(1);\n',
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/components/Smart.tsx",
    'import { useCatalog } from "../../../src/feature-kit/conventions/hooks/use-catalog.hook";\n' +
      'import { useTranslation } from "react-i18next";\n' +
      "export const Smart = () => {\n" +
      "  const [value] = useCatalog();\n" +
      "  const [, t] = useTranslation();\n" +
      '  return value ? t("ready") : "";\n' +
      "};\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/components/Dumb.tsx",
    "export const Dumb = () => null;\n",
  );

  const eslint = createReactLinter(cwd);
  const results = await eslint.lintFiles(["src/**/*.{ts,tsx}"]);

  const smartResult = results.find((result) =>
    result.filePath.endsWith("components/Smart.tsx"),
  );

  const dumbResult = results.find((result) =>
    result.filePath.endsWith("components/Dumb.tsx"),
  );

  assert.equal(smartResult?.messages.length, 0);
  assert.equal(dumbResult?.messages.length, 0);
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: misnamed provider registrations evade an enforceable integration boundary; Contract: linting reports the invalid provider filename and accepts the canonical suffix.
test("keeps react provider boundaries", async () => {
  const cwd = createProject();

  setupCatalogModule(cwd);

  writeProjectFile(
    cwd,
    "src/features/catalog/react-providers/ApolloReactProvider.tsx",
    "reactProvider({});\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/react-providers/apollo.react-provider.tsx",
    "reactProvider({});\n",
  );

  const eslint = createReactLinter(cwd);
  const results = await eslint.lintFiles(["src/**/*.tsx"]);
  const messages = results.flatMap((result) => result.messages);

  assert.equal(
    messages.filter(
      (message) =>
        message.ruleId === "feature-kit-react/react-provider-filename",
    ).length,
    1,
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: parent-workspace invocation can skip React module conventions for the intended project; Contract: linting with explicit project cwd reports the service role violation.
test("uses explicit lint cwd for react module discovery", async () => {
  const launchCwd = createProject();
  const projectCwd = join(launchCwd, "app");

  temporaryDirectories.push(projectCwd);

  setupCatalogModule(projectCwd);
  writeProjectFile(
    projectCwd,
    "src/features/catalog/services/Product.ts",
    "export class Product {}\n",
  );

  const reactConfig = reactEslintConfig(projectCwd);
  const eslint = new ESLint({
    cwd: launchCwd,
    ignore: false,
    overrideConfig: [{ ...reactConfig, basePath: projectCwd }],
    overrideConfigFile: true,
  });

  const results = await eslint.lintFiles([
    "app/src/features/catalog/services/Product.ts",
  ]);
  const messages = results.flatMap((result) => result.messages);

  assert.ok(
    messages.some((message) => message.message.includes('role "services"')),
  );
});
