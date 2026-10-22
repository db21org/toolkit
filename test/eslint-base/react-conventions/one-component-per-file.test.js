import test from "node:test";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "react-conventions/one-component-per-file";
const ruleConfig = "error";

// eslint-disable-next-line db21-tests/require-justification -- A single component with local non-component helpers must remain valid so simple presentation logic stays colocated.
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

// eslint-disable-next-line db21-tests/require-justification -- Lowercase helpers and hooks must not count as components, avoiding false positives in ordinary TSX modules.
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

// eslint-disable-next-line db21-tests/require-justification -- A second exported component must be reported to preserve one public component surface per file.
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

// eslint-disable-next-line db21-tests/require-justification -- Multiple local PascalCase components must be reported so hidden subcomponents move into an explicit local components boundary.
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
