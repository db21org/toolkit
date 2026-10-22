import test from "node:test";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "react-conventions/no-imported-props-types";
const ruleConfig = "error";

// eslint-disable-next-line db21-tests/require-justification -- Non-props imports must remain valid so the local-props rule does not block ordinary component dependencies.
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

// eslint-disable-next-line db21-tests/require-justification -- Types that do not represent component props must remain importable without false positives from name similarity.
test(`${ruleName}: accepts similarly named non-props imports`, async () => {
  await expectValid({
    code: 'import type { ButtonOptions } from "./button";',
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Imported Props types must be rejected so each component owns and documents its own public props contract.
test(`${ruleName}: rejects imported props types`, async () => {
  await expectInvalid({
    code: 'import type { ButtonProps } from "./Button";',
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Props-shaped value imports must also be rejected so type-only syntax cannot become a bypass.
test(`${ruleName}: rejects imported props values`, async () => {
  await expectInvalid({
    code: 'import { DialogProps, createDialog } from "./Dialog";',
    ruleConfig,
    ruleName,
  });
});
