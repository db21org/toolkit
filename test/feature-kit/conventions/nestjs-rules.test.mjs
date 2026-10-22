import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "vitest";

import { ESLint } from "eslint";

import { clearModuleDiscoveryCache } from "../../../src/feature-kit/conventions/config/module-discovery.mjs";
import { createNestjsDependencyCruiserConfig } from "../../../src/feature-kit/conventions/nestjs/dependency-cruiser/index.mjs";
import { createNestjsEslintConfig } from "../../../src/feature-kit/conventions/nestjs/eslint/index.mjs";

const temporaryDirectories = [];

const createProject = () => {
  const cwd = mkdtempSync(join(tmpdir(), "feature-kit-nestjs-rules-"));
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

// eslint-disable-next-line db21-tests/require-justification -- NestJS role direction rules prevent transport and persistence layers from forming unsafe dependencies.
test("adds NestJS dependency direction rules", () => {
  const cwd = createProject();
  writeProjectFile(cwd, "src/features/catalog/catalog.module.ts");
  writeProjectFile(cwd, "src/features/catalog/index.ts");

  const config = createNestjsDependencyCruiserConfig({
    cwd,
    moduleRoots: ["src/features"],
    sourceRoot: "src",
  });
  const names = config.forbidden.map((rule) => rule.name);

  assert.ok(names.includes("feature-kit-no-circular"));
  assert.ok(
    names.includes(
      "feature-kit-nestjs-src-features-catalog-internals-avoid-entry-points",
    ),
  );
  assert.ok(
    names.includes(
      "feature-kit-nestjs-src-features-catalog-repositories-avoid-services",
    ),
  );
  assert.ok(
    names.includes(
      "feature-kit-nestjs-src-features-catalog-passive-types-stay-passive",
    ),
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Role filenames make architectural checks reliable across NestJS feature modules.
test("enforces NestJS role filenames", async () => {
  const cwd = createProject();
  writeProjectFile(cwd, "src/features/catalog/catalog.module.ts");
  writeProjectFile(
    cwd,
    "src/features/catalog/index.ts",
    'export { CatalogModule } from "./catalog.module.js";\n',
  );
  writeProjectFile(cwd, "src/features/catalog/context/Catalog.ts");
  writeProjectFile(cwd, "src/features/catalog/decorators/Catalog.ts");
  writeProjectFile(cwd, "src/features/catalog/guards/Catalog.ts");
  writeProjectFile(cwd, "src/features/catalog/loaders/Catalog.ts");
  writeProjectFile(cwd, "src/features/catalog/mappers/Catalog.ts");
  writeProjectFile(cwd, "src/features/catalog/pipes/Catalog.ts");
  writeProjectFile(cwd, "src/features/catalog/processors/Catalog.ts");
  writeProjectFile(cwd, "src/features/catalog/resolvers/Catalog.ts");
  writeProjectFile(cwd, "src/features/catalog/scalars/Catalog.ts");
  writeProjectFile(cwd, "src/features/catalog/schemas/Catalog.ts");
  writeProjectFile(cwd, "src/features/catalog/controllers/Catalog.ts");
  writeProjectFile(cwd, "src/features/catalog/repositories/Catalog.ts");
  writeProjectFile(cwd, "src/features/catalog/types/Catalog.ts");
  writeProjectFile(cwd, "src/features/catalog/utils/Catalog.ts");
  writeProjectFile(cwd, "src/features/catalog/dto/Catalog.ts");

  const eslint = new ESLint({
    cwd,
    ignore: false,
    overrideConfig: [
      createNestjsEslintConfig({ moduleRoots: ["src/features"] }),
    ],
    overrideConfigFile: true,
  });
  const results = await eslint.lintFiles(["src/**/*.ts"]);
  const messages = results.flatMap((result) => result.messages);

  for (const role of [
    "context",
    "controllers",
    "decorators",
    "guards",
    "loaders",
    "mappers",
    "pipes",
    "processors",
    "repositories",
    "resolvers",
    "scalars",
    "schemas",
    "types",
    "utils",
  ]) {
    assert.ok(
      messages.some((message) => message.message.includes(`role "${role}"`)),
    );
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Restricting module folders prevents ungoverned architectural roles from bypassing policy.
test("allows only approved NestJS module folders", async () => {
  const cwd = createProject();
  writeProjectFile(cwd, "src/features/catalog/catalog.module.ts");
  writeProjectFile(
    cwd,
    "src/features/catalog/index.ts",
    'export { CatalogModule } from "./catalog.module.js";\n',
  );
  writeProjectFile(cwd, "src/features/catalog/types/catalog.type.ts");
  writeProjectFile(cwd, "src/features/catalog/grpc/catalog.grpc.ts");
  writeProjectFile(cwd, "src/features/catalog/models/catalog.model.ts");
  writeProjectFile(cwd, "src/features/catalog/contracts/catalog.contract.ts");

  const eslint = new ESLint({
    cwd,
    ignore: false,
    overrideConfig: [
      createNestjsEslintConfig({ moduleRoots: ["src/features"] }),
    ],
    overrideConfigFile: true,
  });
  const results = await eslint.lintFiles(["src/**/*.ts"]);
  const folderViolations = results.flatMap((result) =>
    result.messages
      .filter(
        (message) =>
          message.ruleId === "feature-kit-core/module-conventions" &&
          message.message.includes("Module folders must be one of"),
      )
      .map(() => result.filePath),
  );

  assert.deepEqual(
    folderViolations
      .map((path) => path.match(/(?:contracts|grpc|models)/u)?.[0])
      .toSorted((left, right) => left?.localeCompare(right ?? "") ?? -1),
    ["contracts", "grpc", "models"],
  );
});

// eslint-disable-next-line db21-tests/require-justification -- GraphQL input and output DTO filenames must encode direction for safe boundary use.
test("requires GraphQL DTO filename direction", async () => {
  const cwd = createProject();
  writeProjectFile(cwd, "src/features/catalog/catalog.module.ts");
  writeProjectFile(
    cwd,
    "src/features/catalog/index.ts",
    'export { CatalogModule } from "./catalog.module.js";\n',
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/dto/create-product.dto.ts",
    "/* @InputType() */\nexport class CreateProductInput {}\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/dto/update-product.input.dto.ts",
    "/* @InputType() */\nexport class UpdateProductInput {}\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/dto/product.output.dto.ts",
    "/* @ObjectType() */\nexport class ProductOutput {}\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/dto/legacy-product.dto.ts",
    "/* @ObjectType() */\nexport class LegacyProductOutput {}\n",
  );

  const eslint = new ESLint({
    cwd,
    ignore: false,
    overrideConfig: [
      createNestjsEslintConfig({ moduleRoots: ["src/features"] }),
    ],
    overrideConfigFile: true,
  });
  const results = await eslint.lintFiles(["src/**/*.ts"]);
  const inputViolations = results.flatMap((result) =>
    result.messages
      .filter(
        (message) => message.ruleId === "feature-kit-nestjs/input-dto-filename",
      )
      .map(() => result.filePath),
  );

  const outputViolations = results.flatMap((result) =>
    result.messages
      .filter(
        (message) =>
          message.ruleId === "feature-kit-nestjs/output-dto-filename",
      )
      .map(() => result.filePath),
  );

  assert.deepEqual(
    inputViolations.map((path) => path.endsWith("create-product.dto.ts")),
    [true],
  );
  assert.deepEqual(
    outputViolations.map((path) => path.endsWith("legacy-product.dto.ts")),
    [true],
  );
});
