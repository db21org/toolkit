import assert from "node:assert/strict";
import test from "node:test";

import { expectValid } from "./lint-rule.js";

// eslint-disable-next-line db21-tests/require-justification -- Parser failures must fail fixtures instead of silently appearing as valid rule behavior.
test("expectValid rejects fatal parser diagnostics", async () => {
  await assert.rejects(
    expectValid({
      code: "const = ;",
      ruleConfig: "error",
      ruleName: "curly",
    }),
    /fixture must parse successfully/u,
  );
});
