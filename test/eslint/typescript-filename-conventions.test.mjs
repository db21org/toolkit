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

// eslint-disable-next-line db21-tests/require-justification -- Kebab-case names and recognized dot roles must remain accepted so generated and hand-written TypeScript files share a stable path convention.
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

// eslint-disable-next-line db21-tests/require-justification -- PascalCase and camelCase TypeScript filenames must be rejected to prevent platform-specific import and casing drift.
test("rejects PascalCase and camelCase TypeScript files", async () => {
  const applicationGraphMessages = await lint("src/ApplicationGraph.ts");
  const applicationGraphCamelCaseMessages = await lint(
    "src/applicationGraph.ts",
  );

  assert.equal(applicationGraphMessages.length, 1);
  assert.equal(applicationGraphCamelCaseMessages.length, 1);
});

// eslint-disable-next-line db21-tests/require-justification -- TSX component filenames are deliberately outside this rule so React component naming can evolve independently.
test("does not govern TSX component filenames yet", async () => {
  const messages = await lint("src/FeedCard.tsx");

  assert.deepEqual(messages, []);
});
