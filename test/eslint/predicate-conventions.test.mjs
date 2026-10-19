import assert from "node:assert/strict";

import { ESLint } from "eslint";
import { test } from "vitest";

import { commonPredicateRestrictedSyntax } from "../../src/eslint/index.mjs";

const eslint = new ESLint({
  ignore: false,
  overrideConfig: [
    {
      files: ["**/*.js"],
      rules: {
        "no-restricted-syntax": ["error", ...commonPredicateRestrictedSyntax],
      },
    },
  ],
  overrideConfigFile: true,
});

const lint = async (source) => {
  const [result] = await eslint.lintText(source, { filePath: "fixture.js" });

  return result.messages.filter(
    (message) => message.ruleId === "no-restricted-syntax",
  );
};

test("rejects relational zero-length comparisons", async () => {
  for (const source of [
    "const result = values.length > 0;",
    "const result = values.length <= 0;",
    "const result = 0 < values.length;",
    "const result = 0 >= values.length;",
  ]) {
    const messages = await lint(source);

    assert.equal(messages.length, 1);
    assert.match(messages[0].message, /Use isEmpty\/isNotEmpty/u);
  }
});

test("allows shared emptiness predicates", async () => {
  const messages = await lint("const result = isNotEmpty(values);");

  assert.deepEqual(messages, []);
});
