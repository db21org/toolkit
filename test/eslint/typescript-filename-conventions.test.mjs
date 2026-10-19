import assert from "node:assert/strict";

import { ESLint } from "eslint";
import { test } from "vitest";

import { typescriptFilenameConventionsPlugin } from "../../src/eslint/plugins/typescript-filename-conventions.mjs";

const eslint = new ESLint({
  ignore: false,
  overrideConfig: [
    {
      files: ["**/*.{cts,mts,ts,tsx}"],
      plugins: { "db21-filenames": typescriptFilenameConventionsPlugin },
      rules: { "db21-filenames/typescript-filename": "error" },
    },
  ],
  overrideConfigFile: true,
});

const lint = async (filePath) => {
  const [result] = await eslint.lintText("export {};\n", { filePath });

  return result.messages;
};

test("accepts kebab-case TypeScript files and dot-separated roles", async () => {
  const productActionStateMessages = await lint(
    "src/product-action-state.output.dto.ts",
  );
  const vitestConfigMessages = await lint("src/vitest.config.ts");
  const indexMessages = await lint("src/index.d.mts");

  assert.deepEqual(productActionStateMessages, []);
  assert.deepEqual(vitestConfigMessages, []);
  assert.deepEqual(indexMessages, []);
});

test("rejects PascalCase and camelCase TypeScript files", async () => {
  const applicationGraphMessages = await lint("src/ApplicationGraph.ts");
  const applicationGraphCamelCaseMessages = await lint(
    "src/applicationGraph.ts",
  );

  assert.equal(applicationGraphMessages.length, 1);
  assert.equal(applicationGraphCamelCaseMessages.length, 1);
});

test("does not govern TSX component filenames yet", async () => {
  const messages = await lint("src/FeedCard.tsx");

  assert.deepEqual(messages, []);
});
