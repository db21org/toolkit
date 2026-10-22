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

// eslint-disable-next-line db21-tests/require-justification -- Length-versus-zero comparisons must be rejected in either operand order so callers use the shared emptiness predicates.
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

// eslint-disable-next-line db21-tests/require-justification -- The approved isNotEmpty predicate must remain accepted as the safe replacement for manual length checks.
test("allows shared emptiness predicates", async () => {
  const messages = await lint("const result = isNotEmpty(values);");

  assert.deepEqual(messages, []);
});
