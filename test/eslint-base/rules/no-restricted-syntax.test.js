import test from "node:test";

import { recommendedRules } from "#eslint-base/rules";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "no-restricted-syntax";
const ruleConfig = recommendedRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- Risk: the supported TypeScript visibility form is rejected; Contract: a TypeScript private field remains lint-clean.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: 'class User { private id = "1"; }',
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: mixed private-field syntax weakens repository visibility conventions; Contract: an ECMAScript hash-private field reports the restriction.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: 'class User { #id = "1"; }',
    ruleConfig,
    ruleName,
  });
});
