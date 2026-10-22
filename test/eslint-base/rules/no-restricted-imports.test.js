import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "no-restricted-imports";
const ruleConfig = recommendedRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- Direct sibling and aliased imports must remain available so module owners can use their public boundaries.
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

// eslint-disable-next-line db21-tests/require-justification -- A deep parent import must be blocked so consumers cannot bypass the owning module boundary through relative traversal.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: 'import { formatName } from "../../shared/formatName";',
    ruleConfig,
    ruleName,
  });
});
