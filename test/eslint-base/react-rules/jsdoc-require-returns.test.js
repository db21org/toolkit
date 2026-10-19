import test from "node:test";

import { reactComponentRules } from "../../../dist/eslint/base/rules.js";
import { expectValid } from "../helpers/lint-rule.js";

const ruleName = "jsdoc/require-returns";
const ruleConfig = reactComponentRules[ruleName];

test(`${ruleName}: disabled for React components`, async () => {
  await expectValid({
    code: `/** Describes the component purpose. */
export const Button = () => null;`,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});
