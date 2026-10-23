import assert from "node:assert/strict";
import test from "node:test";

import { testPolicyPlugin } from "@db21/toolkit/eslint/plugins";
import { Linter } from "eslint";
import tseslint from "typescript-eslint";

const rule = "db21-tests/require-justification";
const reasonRule = "db21-tests/require-local-reason";
const config = {
  plugins: { "db21-tests": testPolicyPlugin },
  rules: { [rule]: "error", [reasonRule]: "error" },
};
const verify = (code) => new Linter().verify(code, config, "example.test.js");

const declarations = [
  'test("risk", () => {});',
  'it.only("risk", handler);',
  'test.todo("risk");',
  'test.each([1])("risk", handler);',
  'test.each`value\n${1}`("risk", handler);',
  'test.skipIf(false)("risk", handler);',
  'import { test as check } from "vitest"; check("risk", handler);',
  'import * as suite from "vitest"; suite.it("risk", handler);',
  'import suite from "node:test"; suite("risk", handler);',
  'import { it } from "@jest/globals"; it("risk", handler);',
];

const unrelated = [
  'describe("suite", () => {});',
  'const test = () => {}; test("not a test");',
  'import { test } from "other-library"; test("not a test");',
  'import * as suite from "vitest"; suite.describe("suite", handler);',
  "test.each([1]);",
  "test.skipIf(false);",
  'const check = /foo/; check.test("foo");',
];

const explanation =
  "Risk: expired tokens permit unauthorized access; Contract: expired credentials never grant access.";

const rejectedDirectives = [
  `// eslint-disable-next-line ${rule}`,
  `// eslint-disable-next-line ${rule} -- coverage`,
  `// eslint-disable-next-line ${rule} -- Regression: expired tokens must never grant access.`,
  `// eslint-disable-next-line ${rule} -- Risk: too short; Contract: access must be denied`,
  `// eslint-disable-next-line ${rule} -- Risk: unauthorized token access; Contract: short`,
  `// eslint-disable-next-line ${rule} -- Contract: access must be denied; Risk: unauthorized token access`,
  `/* eslint-disable ${rule} -- ${explanation} */`,
  `/* eslint ${rule}: off */`,
  `/* eslint "${rule}": "off" */`,
  `/* eslint '${rule}': 'warn' */`,
  `/* eslint ${rule}: 0 */`,
  `/* eslint ${rule}: 1 */`,
  `/* eslint ${rule}: ["off"] */`,
  `/* eslint ${rule}: [1] -- ${explanation} */`,
  `/* eslint no-alert: error, "${rule}": ["warn"] */`,
  `/* eslint\n  "${rule}": 0\n*/`,
];

// eslint-disable-next-line db21-tests/require-justification -- Risk: unjustified tests bypass assessment and add maintenance cost; Contract: recognized tests require local risk and contract fields without blanket exceptions.
test("test policy detects declarations and validates local exceptions", () => {
  const typescriptMessages = new Linter().verify(
    'import assert = require("node:assert/strict"); assert.equal(1, 1);',
    { ...config, languageOptions: { parser: tseslint.parser } },
    "consumer.js",
  );

  assert.deepEqual(typescriptMessages, []);

  for (const code of declarations) {
    assert.deepEqual(
      verify(code).map((message) => message.ruleId),
      [rule],
      code,
    );
  }

  for (const code of unrelated) {
    assert.deepEqual(verify(code), [], code);
  }

  assert.deepEqual(
    verify(
      `// eslint-disable-next-line ${rule} -- ${explanation}\ntest("risk", handler);`,
    ),
    [],
  );
  assert.deepEqual(
    verify(
      `test("risk", handler); // eslint-disable-line ${rule} -- ${explanation}`,
    ),
    [],
  );

  for (const directive of rejectedDirectives) {
    const messages = verify(`${directive}\ntest("risk", handler);`);

    assert.ok(
      messages.some((message) => message.ruleId === reasonRule),
      directive,
    );
  }

  for (const setting of ['"error"', "error", "2", '["error"]', "[2]"]) {
    assert.deepEqual(
      verify(
        `/* eslint "${rule}": ${setting} */\n// eslint-disable-next-line ${rule} -- ${explanation}\ntest("risk", handler);`,
      ),
      [],
      setting,
    );
  }

  assert.deepEqual(
    verify(
      `// eslint-disable-next-line ${rule} -- ${explanation}\ntest("first", handler);\ntest("second", handler);`,
    ).map((message) => message.ruleId),
    [rule],
  );
});
