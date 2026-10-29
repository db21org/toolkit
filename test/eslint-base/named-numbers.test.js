import assert from "node:assert/strict";
import test from "node:test";

import commonConfig from "@db21/toolkit/eslint";
import { recommended } from "@db21/toolkit/eslint/base";
import { namedNumbersPlugin } from "@db21/toolkit/eslint/plugins";
import { ESLint, Linter } from "eslint";
import tseslint from "typescript-eslint";

const rule = "db21-numbers/no-magic-numbers";
const verify = (source) =>
  new Linter().verify(
    source,
    {
      languageOptions: { parser: tseslint.parser },
      plugins: { "db21-numbers": namedNumbersPlugin },
      rules: { [rule]: "error" },
    },
    "consumer.js",
  );

// eslint-disable-next-line db21-tests/require-justification -- Risk: unexplained protocol bounds and numeric parameters silently evade shared policy; Contract: numeric formats and expression contexts report actionable diagnostics without rewriting values or treating directive comments as explanations.
test("rejects unexplained numbers regardless of format or expression context", () => {
  for (const source of [
    "if (codePoint >= 0x10000) act();",
    "consume(500);",
    "const delay = seconds * 1000;",
    "const values = [42];",
    "const settings = { timeout: 500 };",
    "function status() { return 200; }",
    "const result = values[2];",
    "consume(-42);",
    "consume(+42);",
    "consume(0b1010);",
    "consume(0o777);",
    "consume(1.5);",
    "consume(1_000);",
    "consume(42n);",
    "consume(-42n);",
    "/* eslint no-console: off */ consume(42);",
    "/* */ consume(42);",
    "// Explanation for other statement\nprepare();\nconsume(42);",
    "prepare(); // Explanation for previous statement\nconsume(42);",
    "// Detached explanation\n\nconsume(42);",
  ]) {
    const messages = verify(source);

    assert.equal(messages.length, 1, source);
    assert.equal(messages[0].ruleId, rule, source);
    assert.equal(messages[0].messageId, "unexplained", source);
    assert.match(messages[0].message, /named variable.*comment explaining/u);
    assert.equal(messages[0].fix, undefined);
  }

  const bounds = verify(
    "if (codePoint >= 0x10000 && codePoint <= 0x10ffff) act();",
  );

  assert.deepEqual(
    bounds.map((message) => message.messageId),
    ["unexplained", "unexplained"],
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: policy blocks named values, type contracts, or documented domain constants and encourages meaningless churn; Contract: named numeric values, common sentinels and attached explanations pass while strings remain outside scope.
test("allows named numbers and attached explanations", () => {
  for (const source of [
    "const supplementaryPlaneStart = 0x10000;",
    "let retryDelay = 500;",
    "const sentinel = -42;",
    "const retryDelay = 500 as const;",
    "const retryDelay = 500 satisfies number;",
    "class Limits { static readonly timeout = 500; }",
    "enum Status { Ready = 200 }",
    "type Status = 200 | 404;",
    "type Result = { status: -42 };",
    "consume(-1, 0, 1, -1n, 0n, 1n);",
    'consume("repeated", "repeated", true, null);',
    "// Supplementary Unicode plane bounds.\nif (codePoint >= 0x10000 && codePoint <= 0x10ffff) act();",
    "/* Milliseconds per second. */\nconst delay = seconds * 1000;",
    "consume(500); // Retry delay in milliseconds.",
    "consume(/* Retry delay in milliseconds. */ 500);",
    "consume(500 /* Retry delay in milliseconds. */);",
    "consume(\n  // Retry delay in milliseconds.\n  500,\n);",
  ]) {
    assert.deepEqual(verify(source), [], source);
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: shared presets omit numeric policy for a supported language or framework; Contract: JS and TS extensions inherit error severity through base and repository presets and React composition.
test("shared presets enforce named numbers across source extensions", async () => {
  const errorSeverity = 2;

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

      assert.equal(config.rules[rule][0], errorSeverity, extension);
    }
  }
});
