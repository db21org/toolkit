import test from "node:test";

import { recommendedRules } from "#eslint-base/rules";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "@typescript-eslint/parameter-properties";
const ruleConfig = recommendedRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- Constructor parameter properties are the configured concise form and must remain accepted.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: "class User { constructor(private readonly id: string) {} }",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Duplicated field assignment in a constructor must be reported so classes use the configured parameter-property form.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: "class User { private readonly id: string; constructor(id: string) { this.id = id; } }",
    ruleConfig,
    ruleName,
  });
});
