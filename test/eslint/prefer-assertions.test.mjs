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

// eslint-disable-next-line db21-tests/require-justification -- Risk: tests use inconsistent throw-only guards that obscure failed conditions; Contract: representative guards report their prescribed assertion helpers.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: boolean wrappers conceal definedness failures and lose tailored assertions; Contract: wrapped predicates report the corresponding presence helper.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: an autofix-style policy rejects guards whose cleanup side effect is required; Contract: a guard with cleanup remains lint-clean.
test("allows guards that perform additional behavior", async () => {
  const messages = await lint(
    "if (invalid) { cleanup(); throw new Error('failed'); }",
  );

  assert.deepEqual(messages, []);
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: recovery control flow is replaced by an assertion that cannot preserve its else branch; Contract: an if/else guard remains lint-clean.
test("allows if/else control flow", async () => {
  const messages = await lint(
    "if (invalid) { throw new Error('failed'); } else { recover(); }",
  );

  assert.deepEqual(messages, []);
});
