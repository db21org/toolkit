import assert from "node:assert/strict";

import { requireExtractedHooksPlugin } from "@db21/toolkit/eslint/plugins";
import { ESLint } from "eslint";
import typescriptEslint from "typescript-eslint";
import { test } from "vitest";

const targetRule = "db21-hooks/require-extracted-hooks";
const componentHookFixtureLines = [
  "const useProductMedia = () => [];",
  "function useProductState() { return {}; }",
];

const importedHookFixtureLines = [
  'import { useProductMedia } from "../../src/eslint/hooks/use-product-media.hook";',
  "const renderMedia = () => null;",
];

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

// eslint-disable-next-line db21-tests/require-justification -- Risk: component files accumulate reusable hook logic and lose a focused UI boundary; Contract: local custom hook declarations in TSX report extraction errors.
test("rejects custom hook declarations in TSX component files", async () => {
  const messages = await lint(
    componentHookFixtureLines.join("\n"),
    "src/features/feed/components/ProductArtwork.tsx",
  );

  assert.deepEqual(
    messages.map((message) => message.messageId),
    ["extractHook", "extractHook"],
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: valid hook modules, imports, helpers, and fixtures are falsely required to extract; Contract: representative exempt paths and declarations remain lint-clean.
test("allows hook modules, imported hooks, and ordinary component helpers", async () => {
  const fixtures = [
    [
      "export const useProductMedia = () => [];",
      "src/features/feed/hooks/use-product-media.hook.ts",
    ],
    [
      importedHookFixtureLines.join("\n"),
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
