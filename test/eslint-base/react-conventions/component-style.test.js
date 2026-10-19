import test from "node:test";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "react-conventions/component-style";
const ruleConfig = "error";

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

test(`${ruleName}: rejects unannotated components`, async () => {
  await expectInvalid({
    code: "export const Button = () => null;",
    filename: "Button.tsx",
    ruleConfig,
    ruleName,
  });
});
