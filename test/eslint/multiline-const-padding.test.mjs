import assert from "node:assert/strict";

import { ESLint } from "eslint";
import { test } from "vitest";

import { multilineConstPaddingPlugin } from "../../src/eslint/plugins/multiline-const-padding.mjs";

const eslint = new ESLint({
  fix: true,
  ignore: false,
  overrideConfig: [
    {
      files: ["**/*.js"],
      plugins: { "db21-padding": multilineConstPaddingPlugin },
      rules: { "db21-padding/multiline-const-padding": "error" },
    },
  ],
  overrideConfigFile: true,
});

const lint = async (source) => {
  const [result] = await eslint.lintText(source, { filePath: "source.js" });

  return result;
};

test("adds an empty line between multiline const declarations", async () => {
  const result = await lint(`const first = [
  "first",
];
const second = [
  "second",
];`);

  assert.equal(result.errorCount, 0);
  assert.equal(
    result.output,
    `const first = [
  "first",
];

const second = [
  "second",
];`,
  );
});

test("keeps comments attached to the following declaration", async () => {
  const result = await lint(`const first = [
  "first",
];
// Explains the second declaration.
const second = [
  "second",
];`);

  assert.ok(
    result.output?.includes(
      `];

// Explains the second declaration.
const second`,
    ),
  );
});

test("allows compact single-line const groups", async () => {
  const result = await lint("const first = 1;\nconst second = 2;");

  assert.equal(result.output, undefined);
});

test("allows multiline declarations separated by an empty line", async () => {
  const result = await lint(`const first = [
  "first",
];

const second = [
  "second",
];`);

  assert.equal(result.output, undefined);
});
