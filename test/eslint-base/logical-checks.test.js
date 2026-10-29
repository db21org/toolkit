import assert from "node:assert/strict";
import test from "node:test";

import commonConfig from "@db21/toolkit/eslint";
import { recommended } from "@db21/toolkit/eslint/base";
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: consumers evade shared readability limits with lone nested conditions or receive unsafe rewrite advice; Contract: collapsible if pairs report extraction guidance without autofixes while else branches and meaningful outer bodies remain valid.
test("logical checks reject lone nested if statements without changing branch semantics", () => {
  for (const source of [
    "if (a) { if (b) act(); }",
    "if (a) if (b) act();",
    "if (a) { /* comment */ if (b) { act(); } }",
    "if (isDefined(previous) && previous.uri === uri) { if (previous.height === sourceHeight && previous.width === sourceWidth) { return previous; } }",
  ]) {
    const messages = verify(source);

    assert.equal(messages.length, 1, source);
    assert.equal(messages[0].ruleId, rule, source);
    assert.equal(messages[0].messageId, "loneNestedIf", source);
    assert.match(messages[0].message, /both conditions.*before a single if/u);
    assert.match(messages[0].message, /short-circuit.*guard dependent checks/u);
    assert.equal(messages[0].fix, undefined);
    assert.equal(messages[0].suggestions, undefined);
  }

  for (const source of [
    "const isSameSource = isDefined(previous) && previous.uri === uri; const isSameSize = isSameSource && previous.height === sourceHeight && previous.width === sourceWidth; if (isSameSource && isSameSize) { return previous; }",
    "if (a) { prepare(); if (b) act(); }",
    "if (a) { if (b) act(); finish(); }",
    "if (a) { if (b) act(); } else fallback();",
    "if (a) { if (b) act(); else fallback(); }",
    "if (a) if (b) act(); else fallback();",
    "if (a) act(); else if (b) fallback();",
    "if (a) { while (b) act(); }",
  ]) {
    assert.deepEqual(verify(source), [], source);
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: bulky two-check expressions evade operand limits or formatting hides excessive length; Contract: exact 120-character token boundary, literal contents and nested callbacks count consistently without comments or whitespace and produce one actionable error.
test("logical expression length ignores formatting but retains literal and callback content", () => {
  const atLimit = `${"a".repeat(117)}&&b`;
  const overLimit = `${"a".repeat(118)}&&b`;

  assert.deepEqual(verify(`${atLimit};`), []);
  assert.deepEqual(
    verify(`${"a".repeat(117)} /* comment */\n && /* comment */ b;`),
    [],
  );

  for (const expression of [
    overLimit,
    `${"a".repeat(118)} /* comment */\n && b`,
    `a&&"${" ".repeat(116)}"`,
    `a&&items.some((item)=>item.matches("${"x".repeat(90)}"))`,
    `${overLimit}&&c&&d`,
  ]) {
    const messages = verify(`${expression};`);

    assert.equal(messages.length, 1, expression);
    assert.equal(messages[0].ruleId, rule, expression);
    assert.match(messages[0].message, /120 characters.*early returns/u);
    assert.equal(messages[0].fix, undefined);
  }

  assert.match(
    verify(`${overLimit};`)[0].message,
    /2 checks and 121 characters/u,
  );
  assert.deepEqual(verify(`"${"x".repeat(121)}";`), []);
});

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
