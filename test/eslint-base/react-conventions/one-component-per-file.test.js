import test from "node:test";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "react-conventions/one-component-per-file";
const ruleConfig = "error";

test(`${ruleName}: accepts one component per file`, async () => {
  await expectValid({
    code: `
      export const Button = () => null;

      const formatLabel = () => "Label";
    `,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: ignores non-component arrow functions`, async () => {
  await expectValid({
    code: `
      const useButtonState = () => null;
      const buttonIcon = () => null;
    `,
    filename: "button.tsx",
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: rejects multiple exported components`, async () => {
  await expectInvalid({
    code: `
      export const Button = () => null;
      export const ButtonIcon = () => null;
    `,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: rejects multiple local components`, async () => {
  await expectInvalid({
    code: `
      const Button = () => null;
      const Dialog = () => null;
      const Modal = () => null;
    `,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});
