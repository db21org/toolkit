import assert from "node:assert/strict";

import { preferAssertionsPlugin } from "@db21/toolkit/eslint/plugins";
import { ESLint } from "eslint";
import { test } from "vitest";

const eslint = new ESLint({
  ignore: false,
  overrideConfig: [
    {
      files: ["**/*.{js,ts}"],
      plugins: { "db21-assertions": preferAssertionsPlugin },
      rules: { "db21-assertions/prefer-assertions": "error" },
    },
  ],
  overrideConfigFile: true,
});

const lint = async (source) => {
  const [result] = await eslint.lintText(source, { filePath: "source.js" });

  return result.messages;
};

// eslint-disable-next-line db21-tests/require-justification -- Throw-only guards must suggest assertion helpers so failure messages and presence checks use the shared test contract.
test("rejects if statements whose only behavior is throwing", async () => {
  const cases = [
    [
      "if (isDefined(value)) { throw new Error('unexpected'); }",
      "assert.notDefined",
    ],
    [
      "if (isNotDefined(value)) { throw new Error('missing'); }",
      "assert.defined",
    ],
    ["if (!response.ok) throw new Error('failed');", "assert.true"],
    ["if (invalid) { throw new Error('failed'); }", "assert.false"],
  ];

  for (const [source, expectedAssertion] of cases) {
    const messages = await lint(source);

    assert.equal(messages.length, 1);
    assert.match(messages[0].message, new RegExp(expectedAssertion, "u"));
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Boolean wrappers around isDefined and isNotDefined must map to presence assertions instead of obscuring their intent.
test("rejects boolean assertions around shared defined predicates", async () => {
  const cases = [
    ["assert.false(isDefined(value), 'failed');", "assert.notDefined"],
    ["assert.true(isNotDefined(value), 'failed');", "assert.notDefined"],
    ["assert.true(isDefined(value), 'failed');", "assert.defined"],
    ["assert.false(isNotDefined(value), 'failed');", "assert.defined"],
  ];

  for (const [source, expectedAssertion] of cases) {
    const messages = await lint(source);

    assert.equal(messages.length, 1);
    assert.match(messages[0].message, new RegExp(expectedAssertion, "u"));
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Guards with cleanup work must remain valid because replacing them with an assertion would drop required side effects.
test("allows guards that perform additional behavior", async () => {
  const messages = await lint(
    "if (invalid) { cleanup(); throw new Error('failed'); }",
  );

  assert.deepEqual(messages, []);
});

// eslint-disable-next-line db21-tests/require-justification -- If/else control flow must remain valid because an assertion cannot preserve the recovery branch.
test("allows if/else control flow", async () => {
  const messages = await lint(
    "if (invalid) { throw new Error('failed'); } else { recover(); }",
  );

  assert.deepEqual(messages, []);
});
