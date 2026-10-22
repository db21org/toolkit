import test from "node:test";

import { recommendedRules } from "#eslint-base/rules";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "padding-line-between-statements";
const ruleConfig = recommendedRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- A blank line after a declaration must remain accepted so statement groups stay visually separated.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: "const value = 1;\n\nreturnValue(value);",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- A declaration immediately followed by executable work must be reported to preserve the configured readability boundary.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: "const value = 1;\nreturnValue(value);",
    ruleConfig,
    ruleName,
  });
});
