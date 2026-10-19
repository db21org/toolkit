import test from "node:test";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "react-conventions/no-imported-props-types";
const ruleConfig = "error";

test(`${ruleName}: accepts non-props imports`, async () => {
  await expectValid({
    code: `
      import { createButton } from "./button";

      type ButtonProps = {
        label: string;
      };
    `,
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: accepts similarly named non-props imports`, async () => {
  await expectValid({
    code: 'import type { ButtonOptions } from "./button";',
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: rejects imported props types`, async () => {
  await expectInvalid({
    code: 'import type { ButtonProps } from "./Button";',
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: rejects imported props values`, async () => {
  await expectInvalid({
    code: 'import { DialogProps, createDialog } from "./Dialog";',
    ruleConfig,
    ruleName,
  });
});
