import assert from "node:assert/strict";

import astroConfig from "@db21/toolkit/eslint/astro";
import { ESLint } from "eslint";
import { test } from "vitest";

const eslint = new ESLint({
  ignore: false,
  overrideConfig: astroConfig,
  overrideConfigFile: true,
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: Astro frontmatter bypasses the repository assertion safety policy; Contract: an invalid frontmatter guard reports the assertion rule.
test("applies repository TypeScript rules to Astro frontmatter", async () => {
  const source = `---
if (invalid) {
  throw new Error("failed");
}
---
<main />`;

  const [result] = await eslint.lintText(source, {
    filePath: "src/pages/index.astro",
  });

  const assertionMessages = result.messages.filter(
    (message) => message.ruleId === "db21-assertions/prefer-assertions",
  );

  assert.equal(assertionMessages.length, 1);
});
