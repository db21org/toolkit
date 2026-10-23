import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createNestjsDependencyCruiserConfig } from "@db21/toolkit/feature-kit/conventions/nestjs/dependency-cruiser";
import { createNestjsEslintConfig } from "@db21/toolkit/feature-kit/conventions/nestjs/eslint";
import { ESLint } from "eslint";
import { afterEach, test } from "vitest";

import { clearModuleDiscoveryCache } from "#feature-kit-config/module-discovery";

import { assertDependencyCruiserGraph } from "./dependency-cruiser-test-helpers.mjs";

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

// eslint-disable-next-line db21-tests/require-justification -- Risk: persistence code can depend on orchestration services, creating reverse dependencies and unsafe lifecycle coupling; Contract: dependency-cruiser accepts downward dependencies and rejects repository-to-service imports.
test("enforces NestJS dependency direction rules", async () => {
  const cwd = createProject();

  writeProjectFile(cwd, "src/features/catalog/catalog.module.ts");
  writeProjectFile(cwd, "src/features/catalog/index.ts");
  writeProjectFile(
    cwd,
    "src/features/catalog/services/catalog.service.ts",
    "export {};\n",
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/controllers/catalog.controller.ts",
    'import "../services/catalog.service.js";\n',
  );
  writeProjectFile(
    cwd,
    "src/features/catalog/repositories/catalog.repository.ts",
    'import "../services/catalog.service.js";\n',
  );
  writeProjectFile(
    cwd,
    "tsconfig.json",
    '{ "compilerOptions": { "module": "NodeNext", "moduleResolution": "NodeNext" } }\n',
  );

  const config = createNestjsDependencyCruiserConfig({
    cwd,
    moduleRoots: ["src/features"],
    sourceRoot: "src",
    tsConfig: "tsconfig.json",
  });

  await assertDependencyCruiserGraph({
    allowed: ["src/features/catalog/controllers/catalog.controller.ts"],
    config,
    cwd,
    rejected: [
      {
        file: "src/features/catalog/repositories/catalog.repository.ts",
        rule: /feature-kit-nestjs-src-features-catalog-repositories-avoid-services/u,
      },
    ],
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: unrecognized role filenames leave NestJS architectural files outside their governing conventions; Contract: linting reports every supported role with an invalid filename.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: unsupported module folders evade NestJS role conventions and conceal transport or persistence behavior; Contract: linting identifies each unapproved folder while accepting approved folders.
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

const violationPaths = (results, ruleId) =>
  results.flatMap((result) =>
    result.messages
      .filter((message) => message.ruleId === ruleId)
      .map(() => result.filePath),
  );

// eslint-disable-next-line db21-tests/require-justification -- Risk: ambiguous GraphQL DTO names can blur request and response boundary direction; Contract: linting reports input and output decorators whose filenames lack the corresponding suffix.
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
  const inputViolations = violationPaths(
    results,
    "feature-kit-nestjs/input-dto-filename",
  );

  const outputViolations = violationPaths(
    results,
    "feature-kit-nestjs/output-dto-filename",
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
