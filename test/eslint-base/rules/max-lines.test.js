import test from "node:test";

import { maxLinesRules } from "#eslint-base/rules";

import { expectInvalid, expectValid } from "../helpers/lint-rule.js";

const ruleName = "max-lines";
const ruleConfig = maxLinesRules[ruleName];
const oversizedFileLineCount = 301;

// eslint-disable-next-line db21-tests/require-justification -- Risk: concise source files are falsely rejected by the repository file-size limit; Contract: a one-line file remains lint-clean.
test(`${ruleName}: valid`, async () => {
  await expectValid({ code: "const one = 1;", ruleConfig, ruleName });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: oversized source files evade the configured maintainability boundary; Contract: a 301-line file reports max-lines.
test(`${ruleName}: invalid`, async () => {
  await expectInvalid({
    code: Array.from(
      { length: oversizedFileLineCount },
      (_, index) => `const value${index} = ${index};`,
    ).join("\n"),
    ruleConfig,
    ruleName,
  });
});
