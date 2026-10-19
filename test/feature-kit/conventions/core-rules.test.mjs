import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "vitest";

import { ESLint } from "eslint";

import { clearModuleDiscoveryCache } from "../../../src/feature-kit/conventions/config/module-discovery.mjs";
import { createCoreDependencyCruiserConfig } from "../../../src/feature-kit/conventions/core/dependency-cruiser/index.mjs";
import { createCoreEslintConfig } from "../../../src/feature-kit/conventions/core/eslint/index.mjs";

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

test("creates isolation and one-way allow-list rules from discovered modules", () => {
  const cwd = createProject();
  writeProjectFile(cwd, "src/features/catalog/catalog.module.ts");
  writeProjectFile(cwd, "src/features/catalog/index.ts");
  writeProjectFile(cwd, "src/features/orders/orders.module.ts");
  writeProjectFile(cwd, "src/features/orders/index.ts");
  writeProjectFile(cwd, "src/shared/index.ts");

  const config = createCoreDependencyCruiserConfig({
    allow: ["src/shared"],
    cwd,
    moduleRoots: ["src/features"],
    sourceRoot: "src",
  });
  const names = config.forbidden.map((rule) => rule.name);

  assert.ok(
    names.includes(
      "feature-kit-src-features-catalog-imports-owned-public-or-allowed",
    ),
  );
  assert.ok(names.includes("feature-kit-src-features-orders-has-public-api"));
  assert.ok(names.includes("feature-kit-src-shared-stays-module-agnostic"));
});

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
