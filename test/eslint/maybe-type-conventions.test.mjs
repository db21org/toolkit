import assert from "node:assert/strict";

import { typescriptRepositoryRules } from "@db21/toolkit/eslint";
import { ESLint } from "eslint";
import typescriptEslint from "typescript-eslint";
import { test } from "vitest";

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

// eslint-disable-next-line db21-tests/require-justification -- Explicit null unions must be redirected to the shared Maybe abstraction so repository APIs retain one absence representation.
test("requires Maybe for explicit null unions", async () => {
  const [result] = await eslint.lintText("type Value = number | null;", {
    filePath: "fixture.ts",
  });

  assert.equal(result.messages.length, 1);
  assert.match(result.messages[0].message, /Use Maybe<T>/u);
});

// eslint-disable-next-line db21-tests/require-justification -- The sanctioned Maybe wrapper must remain valid so the null-union restriction has a practical safe alternative.
test("allows the shared Maybe type", async () => {
  const [result] = await eslint.lintText("type Value = Maybe<number>;", {
    filePath: "fixture.ts",
  });

  assert.deepEqual(result.messages, []);
});
