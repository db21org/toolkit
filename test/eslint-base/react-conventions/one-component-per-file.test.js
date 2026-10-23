import test from "node:test";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "react-conventions/one-component-per-file";
const ruleConfig = "error";

// eslint-disable-next-line db21-tests/require-justification -- Risk: ordinary local presentation helpers are mistaken for extra components; Contract: one component with lowercase helpers remains lint-clean.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: lowercase helpers and hooks cause false multiple-component reports; Contract: helper and hook declarations remain lint-clean.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: files expose multiple public component surfaces; Contract: a second exported component reports the rule.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: hidden local subcomponents accumulate without an explicit boundary; Contract: multiple PascalCase components report the rule.
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
