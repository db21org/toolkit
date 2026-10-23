import test from "node:test";

import { recommendedRules } from "#eslint-base/rules";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "no-restricted-imports";
const ruleConfig = recommendedRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- Risk: module owners cannot use direct sibling or aliased public boundaries; Contract: permitted direct imports remain lint-clean.
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

// eslint-disable-next-line db21-tests/require-justification -- Risk: consumers bypass module ownership through deep relative traversal; Contract: a parent-reaching import reports the boundary rule.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: 'import { formatName } from "../../shared/formatName";',
    ruleConfig,
    ruleName,
  });
});
