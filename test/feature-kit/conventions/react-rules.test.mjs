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

// eslint-disable-next-line db21-tests/require-justification -- React dependency rules must preserve separation between data, render wiring, and UI roles.
test("extends core dependency rules with render-focused Surface contracts", () => {
  const cwd = createProject();

  setupCatalogModule(cwd);

  const config = createReactDependencyCruiserConfig({
    cwd,
    moduleRoots: ["src/features"],
    sourceRoot: "src",
  });
  const names = config.forbidden.map((rule) => rule.name);

  assert.ok(names.includes("feature-kit-no-circular"));

  for (const suffix of [
    "services-avoid-ui",
    "queries-stay-data-only",
    "hooks-stay-ui-only",
    "surfaces-keep-render-wiring",
    "react-providers-stay-integration-only",
  ]) {
    assert.ok(
      names.includes(`feature-kit-react-src-features-catalog-${suffix}`),
    );
  }

  assert.equal(
    names.includes(
      "feature-kit-react-src-features-catalog-presenters-own-data-only",
    ),
    false,
  );
  assert.equal(
    names.includes(
      "feature-kit-react-src-features-catalog-views-stay-data-passive",
    ),
    false,
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Decorated Surface classes need constrained placement so render wiring remains discoverable and governed.
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

// eslint-disable-next-line db21-tests/require-justification -- Surface classes must not import UI platform concerns that bypass DI and component boundaries.
test("enforces Surface import boundaries and allows DI/component wiring", async () => {
  const cwd = createProject();

  setupCatalogModule(cwd);

  writeProjectFile(
    cwd,
    "src/features/catalog/services/catalog.service.ts",
    "export class CatalogService {}\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/contracts/CatalogContract.ts",
    "export type CatalogContract = { id: string };\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/components/CatalogSurfaceHost.tsx",
    "export const CatalogSurfaceHost = () => null;\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/hooks/use-catalog.hook.ts",
    "export const useCatalog = () => null;\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/queries/catalog.query.ts",
    "export const catalogQuery = () => null;\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/react-providers/App.react-provider.tsx",
    "reactProvider({});\n",
  );
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

// eslint-disable-next-line db21-tests/require-justification -- Unrecognized presentation folders must remain allowed to avoid imposing unsupported architectural roles.
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

// eslint-disable-next-line db21-tests/require-justification -- Components may use hooks and translations without a policy that blocks legitimate UI composition.
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

// eslint-disable-next-line db21-tests/require-justification -- Provider registrations require dedicated filenames so integration boundaries remain enforceable.
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

// eslint-disable-next-line db21-tests/require-justification -- React module discovery must use configured cwd when lint is launched outside the project.
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
