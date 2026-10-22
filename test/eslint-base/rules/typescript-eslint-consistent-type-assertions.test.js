import test from "node:test";

import { recommendedRules } from "#eslint-base/rules";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "@typescript-eslint/consistent-type-assertions";
const ruleConfig = recommendedRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- The configured as-style assertion must remain accepted so TypeScript assertions use one readable syntax.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: 'const input = "value" as unknown as string;',
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Angle-bracket assertions must be rejected because they conflict with JSX parsing and the repository as-style policy.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: "const input = <string>value;",
    ruleConfig,
    ruleName,
  });
});
