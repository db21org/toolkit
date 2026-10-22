import test from "node:test";

import { reactComponentRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "jsdoc/require-jsdoc";
const ruleConfig = reactComponentRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- A documented exported React component must satisfy the component-only JSDoc requirement.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: `/** Describes the component purpose. */
export const Button = () => null;`,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- An undocumented exported React component must be reported rather than bypassing the component documentation policy.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: `export const Button = () => null;`,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});
