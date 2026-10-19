import test from "node:test";

import { reactComponentRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "jsdoc/no-restricted-syntax";
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

test(`${ruleName}: rejects @param tags`, async () => {
  await expectInvalid({
    code: `/**
 * Describes the component purpose.
 * @param props Component props.
 */
export const Button = (props: ButtonProps) => null;`,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: rejects @returns tags`, async () => {
  await expectInvalid({
    code: `/**
 * Describes the component purpose.
 * @returns Root React application element.
 */
export const App = () => null;`,
    filename: "App.tsx",
    ruleConfig,
    ruleName,
  });
});
