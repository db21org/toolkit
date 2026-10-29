import assert from "node:assert/strict";

import commonConfig, {
  createUtilityExtractionConfig,
} from "@db21/toolkit/eslint";
import { ESLint } from "eslint";
import { test } from "vitest";

const privateUtilitySourceLines = [
  "const normalizeMoney = (value) => value.trim();",
  "function parseValue(value) { return value; }",
];

const exportedUtilitySourceLines = [
  "export const mapProduct = (value) => value;",
  "export function parseProduct(value) { return value; }",
  "const values = [1].map((value) => value + 1);",
];

const eslint = new ESLint({
  ignore: false,
  overrideConfig: [createUtilityExtractionConfig({ files: ["**/*.ts"] })],
  overrideConfigFile: true,
});

const lint = async (source, filePath) => {
  const [result] = await eslint.lintText(source, { filePath });

  return result.messages;
};

// eslint-disable-next-line db21-tests/require-justification -- Risk: reusable module transforms remain hidden beside unrelated code; Contract: private top-level function values report extraction errors.
test("rejects private module-scope function values", async () => {
  const messages = await lint(
    privateUtilitySourceLines.join("\n"),
    "src/features/catalog/mappers/product.mapper.ts",
  );

  assert.deepEqual(
    messages.map((message) => message.messageId),
    ["extract", "extract"],
  );
  assert.match(messages[0].message, /Search existing utilities/u);
  assert.match(
    messages[0].message,
    /essential utilities require focused tests/u,
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: extraction policy blocks helpers already at an appropriate ownership boundary; Contract: utilities, tests, entrypoints, modules, and shared helpers remain lint-clean.
test("allows extracted, test, entrypoint, module, and shared utility helpers", async () => {
  const source = "const normalizeMoney = (value) => value;";
  const filePaths = [
    "src/features/catalog/utils/money.util.ts",
    "src/features/catalog/mappers/product.mapper.test.ts",
    "src/main.ts",
    "src/features/catalog/catalog.module.ts",
    "packages/utils/src/money.ts",
  ];

  for (const filePath of filePaths) {
    const messages = await lint(source, filePath);

    assert.deepEqual(messages, []);
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: exported APIs and callbacks are falsely treated as hidden reusable utilities; Contract: exports and nested callbacks remain lint-clean.
test("allows exported APIs and nested callbacks", async () => {
  const messages = await lint(
    exportedUtilitySourceLines.join("\n"),
    "src/features/catalog/mappers/product.mapper.ts",
  );

  assert.deepEqual(messages, []);
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: similarly named sibling directories bypass a configured utility exemption; Contract: only the exact exempt directory remains lint-clean.
test("supports replacement utility exemptions with directory boundaries", async () => {
  const configuredEslint = new ESLint({
    ignore: false,
    overrideConfigFile: true,
    overrideConfig: [
      createUtilityExtractionConfig({
        files: ["**/*.ts"],
        exemptPaths: ["lib/shared"],
      }),
    ],
  });

  for (const [filePath, expectedCount] of [
    ["lib/shared/normalize.ts", 0],
    ["lib/shared-other/normalize.ts", 1],
    ["packages/utils/src/normalize.ts", 1],
    ["other/packages/utils/src/normalize.ts", 1],
  ]) {
    const [result] = await configuredEslint.lintText(
      "const normalize = (value) => value;",
      { filePath },
    );

    assert.equal(result.messages.length, expectedCount, filePath);
  }

  const common = new ESLint({
    overrideConfigFile: true,
    overrideConfig: commonConfig,
  });
  const config = await common.calculateConfigForFile("src/example.ts");

  assert.equal(
    config.rules["db21-utilities/require-extracted-utilities"],
    undefined,
  );
});
