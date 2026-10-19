import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "no-restricted-imports";
const ruleConfig = recommendedRules[ruleName];

test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: `
      import { Button } from "../Button";
      import { formatName } from "@/shared/formatName";
    `,
    ruleConfig,
    ruleName,
  });
});

test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: 'import { formatName } from "../../shared/formatName";',
    ruleConfig,
    ruleName,
  });
});
