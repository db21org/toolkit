import test from "node:test";

import { maxLinesRules } from "#eslint-base/rules";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "max-lines";
const ruleConfig = maxLinesRules[ruleName];

// eslint-disable-next-line db21-tests/require-justification -- A one-line source file must remain below the configured 300-line repository limit.
test(`${ruleName}: valid`, async () => {
  await expectValid({ code: "const one = 1;", ruleConfig, ruleName });
});

// eslint-disable-next-line db21-tests/require-justification -- A 301-line source file must exceed the configured 300-line repository limit.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: Array.from(
      { length: 301 },
      (_, index) => `const value${index} = ${index};`,
    ).join("\n"),
    ruleConfig,
    ruleName,
  });
});
