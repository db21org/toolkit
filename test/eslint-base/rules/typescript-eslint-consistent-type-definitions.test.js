import test from "node:test";

import { recommendedRules } from "../../../dist/eslint/base/rules.js";
import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "@typescript-eslint/consistent-type-definitions";
const ruleConfig = recommendedRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- Type aliases must remain accepted as the configured object-shape declaration style.
test(`${ruleName}: valid`, async () => {
  await expectValid({
    code: "type User = { name: string };",
    ruleConfig,
    ruleName,
  });
});

// eslint-disable-next-line db21-tests/require-justification -- Interfaces must be rejected so structural type declarations do not drift between two competing forms.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: "interface User { name: string }",
    ruleConfig,
    ruleName,
  });
});
