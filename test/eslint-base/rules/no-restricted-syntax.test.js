import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "no-restricted-syntax";
const ruleConfig = recommendedRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- TypeScript private fields must remain the safe alternative to ECMAScript hash-private naming.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: 'class User { private id = "1"; }',
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Hash-private fields must be reported so visibility stays consistent with TypeScript private and protected conventions.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: 'class User { #id = "1"; }',
    ruleConfig,
    ruleName,
  });
});
