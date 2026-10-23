import test from "node:test";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "react-conventions/no-imported-props-types";
const ruleConfig = "error";

// eslint-disable-next-line db21-tests/require-justification -- Risk: ordinary component dependencies are blocked by the local-props policy; Contract: a non-props import remains lint-clean.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: similarly named non-props types are falsely treated as component contracts; Contract: a non-props type import remains lint-clean.
test(`${ruleName}: accepts similarly named non-props imports`, async () => {
  await expectValid({
    code: 'import type { ButtonOptions } from "./button";',
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: components hide their public props contract in another module; Contract: imported Props types report the ownership rule.
test(`${ruleName}: rejects imported props types`, async () => {
  await expectInvalid({
    code: 'import type { ButtonProps } from "./Button";',
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: value imports bypass locally owned component props typing; Contract: a Props-shaped value import reports the rule.
test(`${ruleName}: rejects imported props values`, async () => {
  await expectInvalid({
    code: 'import { DialogProps, createDialog } from "./Dialog";',
    ruleConfig,
    ruleName,
  });
});
