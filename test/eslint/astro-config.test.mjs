import assert from "node:assert/strict";

import { ESLint } from "eslint";
import { test } from "vitest";

import astroConfig from "../../src/eslint/astro.mjs";

const eslint = new ESLint({
  ignore: false,
  overrideConfig: astroConfig,
  overrideConfigFile: true,
});

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
