import assert from "node:assert/strict";

import astroConfig from "@db21/toolkit/eslint/astro";
import { ESLint } from "eslint";
import { test } from "vitest";

const eslint = new ESLint({
  ignore: false,
  overrideConfig: astroConfig,
  overrideConfigFile: true,
});

// eslint-disable-next-line db21-tests/require-justification -- Astro frontmatter must receive the TypeScript assertion policy so template failures cannot bypass repository safety checks.
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
