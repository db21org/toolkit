import test from "node:test";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "react-conventions/component-style";
const ruleConfig = "error";

// eslint-disable-next-line db21-tests/require-justification -- Risk: supported directly exported typed components are rejected; Contract: a direct FC declaration remains lint-clean.
test(`${ruleName}: accepts exported FC arrow components`, async () => {
  await expectValid({
    code: `
      import type { FC } from "react";

      type ButtonProps = {
        label: string;
      };

      export const Button: FC<ButtonProps> = () => null;
    `,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: equivalent React.FC annotations are falsely rejected; Contract: a namespace-qualified FC declaration remains lint-clean.
test(`${ruleName}: accepts exported React.FC arrow components`, async () => {
  await expectValid({
    code: `
      import type React from "react";

      type ButtonProps = {
        label: string;
      };

      export const Button: React.FC<ButtonProps> = () => null;
    `,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: component declarations drift from the repository const-component convention; Contract: a PascalCase function declaration reports the style rule.
test(`${ruleName}: rejects PascalCase function declarations`, async () => {
  await expectInvalid({
    code: `
      export function Button() {
        return null;
      }
    `,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: delayed component exports obscure public ownership and visibility; Contract: a later-exported component reports the style rule.
test(`${ruleName}: rejects components not exported at declaration time`, async () => {
  await expectInvalid({
    code: `
      import type { FC } from "react";

      type ButtonProps = {
        label: string;
      };

      const Button: FC<ButtonProps> = () => null;
    `,
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: component props become implicit through unannotated PascalCase arrows; Contract: an untyped component arrow reports the style rule.
test(`${ruleName}: rejects unannotated components`, async () => {
  await expectInvalid({
    code: "export const Button = () => null;",
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});
