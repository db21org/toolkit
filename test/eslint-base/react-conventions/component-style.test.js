import test from "node:test";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "react-conventions/component-style";
const ruleConfig = "error";

// eslint-disable-next-line db21-tests/require-justification -- Directly exported FC components are the supported declaration form and must remain available to React consumers.
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

// eslint-disable-next-line db21-tests/require-justification -- React.FC namespace annotations are equivalent to FC imports and must not be rejected by the style rule.
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

// eslint-disable-next-line db21-tests/require-justification -- PascalCase function declarations must be reported to preserve the repository const-component declaration convention.
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

// eslint-disable-next-line db21-tests/require-justification -- A component exported later must be reported because direct export at declaration makes ownership and API visibility explicit.
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

// eslint-disable-next-line db21-tests/require-justification -- An unannotated PascalCase arrow function must be reported so component props stay intentionally typed.
test(`${ruleName}: rejects unannotated components`, async () => {
  await expectInvalid({
    code: "export const Button = () => null;",
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});
