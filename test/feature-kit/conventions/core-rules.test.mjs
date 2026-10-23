import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCoreDependencyCruiserConfig } from "@db21/toolkit/feature-kit/conventions/core/dependency-cruiser";
import { createCoreEslintConfig } from "@db21/toolkit/feature-kit/conventions/core/eslint";
import { ESLint } from "eslint";
import { afterEach, test } from "vitest";

import { clearModuleDiscoveryCache } from "#feature-kit-config/module-discovery";

import { assertDependencyCruiserGraph } from "./dependency-cruiser-test-helpers.mjs";

const temporaryDirectories = [];

const createProject = () => {
  const cwd = mkdtempSync(join(tmpdir(), "feature-kit-core-rules-"));

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

// eslint-disable-next-line db21-tests/require-justification -- Risk: feature internals or shared code can bypass module ownership and couple unrelated features; Contract: dependency-cruiser accepts public and allow-listed imports but rejects direct cross-module internals.
test("enforces module isolation and one-way shared-code dependencies", async () => {
  const cwd = createProject();

  writeProjectFile(cwd, "src/features/catalog/catalog.module.ts");
  writeProjectFile(cwd, "src/features/catalog/index.ts");
  writeProjectFile(cwd, "src/features/orders/orders.module.ts");
  writeProjectFile(cwd, "src/features/orders/index.ts");
  writeProjectFile(cwd, "src/features/catalog/internal.ts");
  writeProjectFile(
    cwd,
    "src/features/orders/allowed.ts",
    'import "../catalog/index.js";\n',
  );
  writeProjectFile(
    cwd,
    "src/features/orders/rejected.ts",
    'import "../catalog/internal.js";\n',
  );
  writeProjectFile(cwd, "src/shared/index.ts");
  writeProjectFile(
    cwd,
    "src/features/orders/shared-allowed.ts",
    'import "../../shared/index.js";\n',
  );
  writeProjectFile(
    cwd,
    "src/shared/rejected.ts",
    'import "../features/catalog/index.js";\n',
  );

  const config = createCoreDependencyCruiserConfig({
    allow: ["src/shared"],
    cwd,
    moduleRoots: ["src/features"],
    sourceRoot: "src",
  });

  await assertDependencyCruiserGraph({
    allowed: [
      "src/features/orders/allowed.ts",
      "src/features/orders/shared-allowed.ts",
    ],
    config,
    cwd,
    rejected: [
      {
        file: "src/features/orders/rejected.ts",
        rule: /feature-kit-src-features-orders-imports-owned-public-or-allowed/u,
      },
      {
        file: "src/shared/rejected.ts",
        rule: /feature-kit-src-shared-stays-module-agnostic/u,
      },
    ],
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: nested feature modules produce ambiguous ownership rules that can silently misclassify imports; Contract: configuration rejects a discovered module beneath another module.
test("rejects nested recommended module boundaries", () => {
  const cwd = createProject();

  writeProjectFile(cwd, "src/features/catalog/catalog.module.ts");
  writeProjectFile(cwd, "src/features/catalog/reviews/reviews.module.ts");

  assert.throws(
    () =>
      createCoreDependencyCruiserConfig({
        cwd,
        moduleRoots: ["src/features"],
        sourceRoot: "src",
      }),
    /contains nested module/u,
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: allowing a feature directory as shared code would expose its internals across module boundaries; Contract: configuration rejects allow-list paths overlapping a discovered module.
test("rejects allow-list paths that overlap a module", () => {
  const cwd = createProject();

  writeProjectFile(cwd, "src/features/catalog/catalog.module.ts");
  writeProjectFile(cwd, "src/features/catalog/index.ts");

  assert.throws(
    () =>
      createCoreDependencyCruiserConfig({
        allow: ["src/features"],
        cwd,
        moduleRoots: ["src/features"],
        sourceRoot: "src",
      }),
    /overlaps Feature Kit module/u,
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: workspace-parent invocation can discover the wrong project and omit required role diagnostics; Contract: linting with an explicit project cwd reports the service role violation.
test("uses explicit cwd for module discovery when linted from another directory", async () => {
  const launchCwd = createProject();
  const projectCwd = join(launchCwd, "app");

  temporaryDirectories.push(projectCwd);

  writeProjectFile(
    projectCwd,
    "src/features/catalog/catalog.module.ts",
    "export class CatalogModule {}\n",
  );
  writeProjectFile(
    projectCwd,
    "src/features/catalog/index.ts",
    'export { CatalogModule } from "./catalog.module.js";\n',
  );
  writeProjectFile(
    projectCwd,
    "src/features/catalog/services/Product.ts",
    "export class Product {}\n",
  );

  const coreConfig = createCoreEslintConfig({
    cwd: projectCwd,
    moduleRoots: ["src/features"],
  });

  const eslint = new ESLint({
    cwd: launchCwd,
    ignore: false,
    overrideConfig: [{ ...coreConfig, basePath: projectCwd }],
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: malformed module files and barrels can make public ownership indeterminate; Contract: linting reports each invalid module, barrel, service filename, and missing module export.
test("reports invalid module, barrel, and service naming", async () => {
  const cwd = createProject();

  writeProjectFile(
    cwd,
    "src/features/catalog/wrong.module.ts",
    "export class WrongModule {}\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/index.ts",
    'export { WrongModule } from "./other.js";\nexport * from "./wrong.module.js";\n',
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/services/Product.ts",
    "export class Product {}\n",
  );

  const eslint = new ESLint({
    cwd,
    ignore: false,
    overrideConfig: [createCoreEslintConfig({ moduleRoots: ["src/features"] })],
    overrideConfigFile: true,
  });
  const results = await eslint.lintFiles(["src/**/*.ts"]);
  const messages = results.flatMap((result) => result.messages);

  assert.ok(
    messages.some((message) => message.message.includes("catalog.module.ts")),
  );
  assert.ok(
    messages.some((message) =>
      message.message.includes("explicit named exports"),
    ),
  );
  assert.ok(
    messages.some((message) =>
      message.message.includes("must explicitly export its module"),
    ),
  );
  assert.ok(
    messages.some((message) => message.message.includes('role "services"')),
  );
});
