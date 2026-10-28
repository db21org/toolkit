import assert from "node:assert/strict";
import test from "node:test";

import commonConfig from "@db21/toolkit/eslint";
import { react, recommended } from "@db21/toolkit/eslint/base";
import { logicalChecksPlugin } from "@db21/toolkit/eslint/plugins";
import { ESLint, Linter } from "eslint";
import tseslint from "typescript-eslint";

const rule = "db21-logic/max-checks";
const verify = (source) =>
  new Linter().verify(
    source,
    {
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      plugins: { "db21-logic": logicalChecksPlugin },
      rules: { [rule]: "error" },
    },
    "consumer.js",
  );

const rejected = [
  "if (a && b && c && d) act();",
  "const result = a && b && (c || d) || e;",
  "const result = a && b && c && d ? yes : no;",
  "function check() { return a || b || c || d; }",
  "while (a && b && c && d) act();",
  "consume(a && b && c && d);",
  "const fallback = a ?? b ?? c ?? d;",
  "const result = a && !(b || c || d);",
  "const result = a && ((b || c || d) as boolean);",
  "const result = a && ((b || c || d) satisfies boolean);",
  "const element = <span>{a && b && c && d}</span>;",
];

// eslint-disable-next-line db21-tests/require-justification -- Risk: nested or non-if logical chains escape readability enforcement or produce duplicate noise; Contract: four operands report once across expression contexts and presets while three operands and independent expressions remain valid.
test("logical check limit counts nested operands in every expression context", async () => {
  for (const source of rejected) {
    const messages = verify(source);

    assert.equal(messages.length, 1, source);
    assert.equal(messages[0].ruleId, rule, source);
    assert.match(
      messages[0].message,
      /maximum is 3.*early returns.*short-circuit/u,
    );
    assert.equal(messages[0].fix, undefined);
  }

  for (const source of [
    "const result = a && (b || c);",
    "const result = a ?? b ?? c;",
    "const result = a && b ? c || d || e : f && g && h;",
    "consume(a && b && c, d && e && f);",
    "if (!a) returnValue(); if (!b) returnValue();",
    "const result = a && (() => b && c && d);",
  ]) {
    assert.deepEqual(verify(source), [], source);
  }

  assert.equal(
    verify("const result = a && b && c && d ? e || f || g || h : i;").length,
    2,
  );
  assert.equal(react.rules[rule], "error");

  for (const preset of [recommended, commonConfig]) {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: preset,
    });

    for (const extension of [
      "js",
      "jsx",
      "mjs",
      "cjs",
      "ts",
      "tsx",
      "mts",
      "cts",
    ]) {
      const config = await eslint.calculateConfigForFile(
        `consumer.${extension}`,
      );

      assert.equal(config.rules[rule][0], 2, extension);
    }
  }
});
