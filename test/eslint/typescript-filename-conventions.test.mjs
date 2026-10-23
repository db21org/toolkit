import assert from "node:assert/strict";

import { typescriptFilenameConventionsPlugin } from "@db21/toolkit/eslint/plugins";
import { ESLint } from "eslint";
import { test } from "vitest";

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

// eslint-disable-next-line db21-tests/require-justification -- Risk: valid generated and handwritten TypeScript paths are rejected; Contract: kebab-case names with recognized dot roles remain lint-clean.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: filename casing drift breaks imports on case-sensitive platforms; Contract: PascalCase and camelCase TypeScript paths report errors.
test("rejects PascalCase and camelCase TypeScript files", async () => {
  const applicationGraphMessages = await lint("src/ApplicationGraph.ts");
  const applicationGraphCamelCaseMessages = await lint(
    "src/applicationGraph.ts",
  );

  assert.equal(applicationGraphMessages.length, 1);
  assert.equal(applicationGraphCamelCaseMessages.length, 1);
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: TypeScript filename policy prematurely constrains component naming; Contract: a PascalCase TSX path remains lint-clean.
test("does not govern TSX component filenames yet", async () => {
  const messages = await lint("src/FeedCard.tsx");

  assert.deepEqual(messages, []);
});
