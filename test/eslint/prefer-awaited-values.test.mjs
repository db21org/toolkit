import assert from "node:assert/strict";

import { preferAwaitedValuesPlugin } from "@db21/toolkit/eslint/plugins";
import { ESLint } from "eslint";
import { test } from "vitest";

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

// eslint-disable-next-line db21-tests/require-justification -- Risk: asynchronous values enter APIs without an inspectable named boundary; Contract: awaited call arguments report the argument diagnostic.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: return paths conceal asynchronous work and values; Contract: awaited return expressions report the return diagnostic.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: the prescribed named-await form is rejected and encourages hidden awaits; Contract: named values may be passed onward and returned lint-clean.
test("allows named awaited values in calls and returns", async () => {
  const messages = await lint(
    "const value = await load(); consume(value); return value;",
  );

  assert.deepEqual(messages, []);
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: callback-local awaits are falsely attributed to their outer call; Contract: a nested callback await remains lint-clean.
test("does not treat awaits inside callback functions as outer call arguments", async () => {
  const messages = await lint(
    "consume(async () => { const value = await load(); return value; });",
  );

  assert.deepEqual(messages, []);
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: nested return-await expressions evade the rule at their own function boundary; Contract: a callback return-await reports the return diagnostic.
test("still rejects return await inside a callback function", async () => {
  const messages = await lint("consume(async () => { return await load(); });");

  assert.equal(messages.length, 1);
  assert.equal(messages[0].messageId, "return");
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: the rule over-restricts valid local asynchronous composition; Contract: array-contained awaits remain lint-clean.
test("allows awaited values outside calls and returns", async () => {
  const messages = await lint(
    "const values = [await first(), await second()];",
  );

  assert.deepEqual(messages, []);
});
