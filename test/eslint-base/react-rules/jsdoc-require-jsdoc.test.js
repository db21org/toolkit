import test from "node:test";

import { reactComponentRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "jsdoc/require-jsdoc";
const ruleConfig = reactComponentRules[ruleName];

test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: `/** Describes the component purpose. */
export const Button = () => null;`,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: `export const Button = () => null;`,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});
