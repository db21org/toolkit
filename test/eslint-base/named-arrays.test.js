import assert from "node:assert/strict";
import test from "node:test";

import commonConfig from "@db21/toolkit/eslint";
import { react, recommended } from "@db21/toolkit/eslint/base";
import { namedArraysPlugin } from "@db21/toolkit/eslint/plugins";
import { ESLint, Linter } from "eslint";
import tseslint from "typescript-eslint";

const rule = "db21-arrays/no-inline-member-access";
const verify = (source) =>
  new Linter().verify(
    source,
    {
      files: ["**/*.ts"],
      languageOptions: { parser: tseslint.parser },
      plugins: { "db21-arrays": namedArraysPlugin },
      rules: { [rule]: "error" },
    },
    "consumer.ts",
  );

// eslint-disable-next-line db21-tests/require-justification -- Risk: anonymous domain lists bypass naming policy through indexes, optional access or TypeScript wrappers; Contract: every direct literal member access reports extraction guidance without unsafe hoisting fixes while named arrays and ordinary array uses remain valid.
test("requires names before array literal member access", () => {
  for (const source of [
    "[400, 409, 422].some((status) => error.status === status);",
    "[].map(transform);",
    "[a, b].includes(value);",
    "[a, b][index];",
    "[a, b].length;",
    '[a, b]["some"](predicate);',
    "[a, b]?.length;",
    "[a, b]?.some?.(predicate);",
    "([...values]).sort().reverse();",
    "([a, b] as const).length;",
    "(<number[]>[a, b])[index];",
    "([a, b] satisfies number[]).length;",
    "([a, b]!).length;",
    "// Accepted status codes.\n[400, 409, 422].includes(status);",
  ]) {
    const messages = verify(source);

    assert.equal(messages.length, 1, source);
    assert.equal(messages[0].ruleId, rule, source);
    assert.equal(messages[0].messageId, "extract", source);
    assert.match(messages[0].message, /named constant.*same evaluation scope/u);
    assert.equal(messages[0].fix, undefined);
    assert.equal(messages[0].suggestions, undefined);
  }

  for (const source of [
    "const statuses = [badRequest, conflict, unprocessable]; statuses.some((status) => error.status === status);",
    "const values = [a, b]; values[index]; values.length; values?.map(transform);",
    "consume([a, b]);",
    "function values() { return [a, b]; }",
    "const values = [...items];",
    "const [first] = values;",
    "items.map(() => [a, b]);",
    "Array.from(items).map(transform);",
    '"text".length;',
    "({ value: item }).value;",
  ]) {
    assert.deepEqual(verify(source), [], source);
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: a shared preset silently omits anonymous-array enforcement for a supported language; Contract: every JS and TS extension inherits error severity in shared presets and React composition.
test("shared presets require named arrays", async () => {
  assert.equal(react.rules[rule], "error");

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
