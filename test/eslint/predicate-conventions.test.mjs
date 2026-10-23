import assert from "node:assert/strict";

import { commonPredicateRestrictedSyntax } from "@db21/toolkit/eslint";
import { ESLint } from "eslint";
import { test } from "vitest";

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

// eslint-disable-next-line db21-tests/require-justification -- Risk: callers duplicate emptiness semantics with inconsistent operand ordering; Contract: both zero-length comparison orders report the predicate guidance.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: the required emptiness replacement is itself rejected; Contract: isNotEmpty remains lint-clean.
test("allows shared emptiness predicates", async () => {
  const messages = await lint("const result = isNotEmpty(values);");

  assert.deepEqual(messages, []);
});
