import assert from "node:assert/strict";

import { ESLint } from "eslint";
import typescriptEslint from "typescript-eslint";
import { test } from "vitest";

import { typescriptRepositoryRules } from "../../src/eslint/index.mjs";

const [, ...restrictedSyntax] =
  typescriptRepositoryRules["no-restricted-syntax"];

const eslint = new ESLint({
  ignore: false,
  overrideConfig: [
    {
      files: ["**/*.ts"],
      languageOptions: { parser: typescriptEslint.parser },
      rules: {
        "no-restricted-syntax": ["error", ...restrictedSyntax],
      },
    },
  ],
  overrideConfigFile: true,
});

test("requires Maybe for explicit null unions", async () => {
  const [result] = await eslint.lintText("type Value = number | null;", {
    filePath: "fixture.ts",
  });

  assert.equal(result.messages.length, 1);
  assert.match(result.messages[0].message, /Use Maybe<T>/u);
});

test("allows the shared Maybe type", async () => {
  const [result] = await eslint.lintText("type Value = Maybe<number>;", {
    filePath: "fixture.ts",
  });

  assert.deepEqual(result.messages, []);
});
