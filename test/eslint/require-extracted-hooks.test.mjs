import assert from "node:assert/strict";

import { ESLint } from "eslint";
import typescriptEslint from "typescript-eslint";
import { test } from "vitest";

import { requireExtractedHooksPlugin } from "../../src/eslint/plugins/index.mjs";

const targetRule = "db21-hooks/require-extracted-hooks";
const eslint = new ESLint({
  ignore: false,
  overrideConfig: [
    {
      files: ["**/*.{ts,tsx}"],
      languageOptions: { parser: typescriptEslint.parser },
      plugins: { "db21-hooks": requireExtractedHooksPlugin },
      rules: { [targetRule]: "error" },
    },
  ],
  overrideConfigFile: true,
});

const lint = async (source, filePath) => {
  const [result] = await eslint.lintText(source, { filePath });

  return result.messages.filter((message) => message.ruleId === targetRule);
};

// eslint-disable-next-line db21-tests/require-justification -- Custom hooks declared beside a TSX component must be extracted so component files retain a single UI responsibility.
test("rejects custom hook declarations in TSX component files", async () => {
  const messages = await lint(
    [
      "const useProductMedia = () => [];",
      "function useProductState() { return {}; }",
    ].join("\n"),
    "src/features/feed/components/ProductArtwork.tsx",
  );

  assert.deepEqual(
    messages.map((message) => message.messageId),
    ["extractHook", "extractHook"],
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Dedicated hook modules, imports, ordinary helpers, and test fixtures must remain exempt from the component-file extraction rule.
test("allows hook modules, imported hooks, and ordinary component helpers", async () => {
  const fixtures = [
    [
      "export const useProductMedia = () => [];",
      "src/features/feed/hooks/use-product-media.hook.ts",
    ],
    [
      [
        'import { useProductMedia } from "../../src/eslint/hooks/use-product-media.hook";',
        "const renderMedia = () => null;",
      ].join("\n"),
      "src/features/feed/components/ProductArtwork.tsx",
    ],
    [
      "const useProductMedia = () => [];",
      "src/features/feed/test/product-artwork.test.tsx",
    ],
  ];

  for (const [source, filePath] of fixtures) {
    const messages = await lint(source, filePath);

    assert.deepEqual(messages, []);
  }
});
