import assert from "node:assert/strict";

import { ESLint } from "eslint";
import typescriptEslint from "typescript-eslint";
import { test } from "vitest";

import { noUnsafeDoubleAssertionPlugin } from "../../src/eslint/plugins/index.mjs";

const targetRule = "db21-types/no-unsafe-double-assertion";
const eslint = new ESLint({
  ignore: false,
  overrideConfig: [
    {
      files: ["**/*.ts"],
      languageOptions: { parser: typescriptEslint.parser },
      plugins: { "db21-types": noUnsafeDoubleAssertionPlugin },
      rules: { [targetRule]: "error" },
    },
  ],
  overrideConfigFile: true,
});

const lint = async (source) => {
  const [result] = await eslint.lintText(source, { filePath: "fixture.ts" });

  return result.messages.filter((message) => message.ruleId === targetRule);
};

test("rejects assertions through unknown and any", async () => {
  for (const source of [
    "const result = value as unknown as Result;",
    "const result = value as any as Result;",
  ]) {
    const messages = await lint(source);

    assert.equal(messages.length, 1);
  }
});

test("allows single and non-escape-hatch assertions", async () => {
  for (const source of [
    "const result = value as Result;",
    "const result = (value as Partial<Result>) as Result;",
  ]) {
    const messages = await lint(source);

    assert.deepEqual(messages, []);
  }
});
