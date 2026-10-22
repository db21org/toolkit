import assert from "node:assert/strict";

import { multilineConstPaddingPlugin } from "@db21/toolkit/eslint/plugins";
import { ESLint } from "eslint";
import { test } from "vitest";

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

// eslint-disable-next-line db21-tests/require-justification -- The fixer must insert exactly one separator between multiline declarations so grouped definitions remain readable.
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

// eslint-disable-next-line db21-tests/require-justification -- A separator fix must leave a leading comment attached to its declaration rather than changing comment ownership.
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

// eslint-disable-next-line db21-tests/require-justification -- Compact scalar declarations are intentionally exempt so the formatter rule does not create noisy vertical whitespace.
test("allows compact single-line const groups", async () => {
  const result = await lint("const first = 1;\nconst second = 2;");

  assert.equal(result.output, undefined);
});

// eslint-disable-next-line db21-tests/require-justification -- Already separated multiline declarations must be idempotent so lint fixing does not churn clean files.
test("allows multiline declarations separated by an empty line", async () => {
  const result = await lint(`const first = [
  "first",
];

const second = [
  "second",
];`);

  assert.equal(result.output, undefined);
});
