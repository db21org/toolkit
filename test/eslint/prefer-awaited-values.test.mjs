import assert from "node:assert/strict";

import { ESLint } from "eslint";
import { test } from "vitest";

import { preferAwaitedValuesPlugin } from "../../src/eslint/plugins/prefer-awaited-values.mjs";

const eslint = new ESLint({
  ignore: false,
  overrideConfig: [
    {
      files: ["**/*.js"],
      plugins: { "db21-await": preferAwaitedValuesPlugin },
      rules: { "db21-await/prefer-awaited-values": "error" },
    },
  ],
  overrideConfigFile: true,
});

const lint = async (statement) => {
  const source = `async function run() { ${statement} }`;
  const [result] = await eslint.lintText(source, { filePath: "source.js" });

  return result.messages;
};

test("rejects awaited values nested in function arguments", async () => {
  const cases = [
    "consume(await load());",
    "consume({ value: await load() });",
    "consume(condition ? await load() : fallback);",
    "consume(...(await load()));",
    "new Resource(await load());",
  ];

  for (const source of cases) {
    const messages = await lint(source);

    assert.equal(messages.length, 1);
    assert.equal(messages[0].messageId, "argument");
  }
});

test("rejects awaited values nested in returned expressions", async () => {
  const cases = [
    "return await load();",
    "return { value: await load() };",
    "return condition ? await load() : fallback;",
  ];

  for (const source of cases) {
    const messages = await lint(source);

    assert.equal(messages.length, 1);
    assert.equal(messages[0].messageId, "return");
  }
});

test("allows named awaited values in calls and returns", async () => {
  const messages = await lint(
    "const value = await load(); consume(value); return value;",
  );

  assert.deepEqual(messages, []);
});

test("does not treat awaits inside callback functions as outer call arguments", async () => {
  const messages = await lint(
    "consume(async () => { const value = await load(); return value; });",
  );

  assert.deepEqual(messages, []);
});

test("still rejects return await inside a callback function", async () => {
  const messages = await lint("consume(async () => { return await load(); });");

  assert.equal(messages.length, 1);
  assert.equal(messages[0].messageId, "return");
});

test("allows awaited values outside calls and returns", async () => {
  const messages = await lint(
    "const values = [await first(), await second()];",
  );

  assert.deepEqual(messages, []);
});
