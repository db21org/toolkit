import assert from "node:assert/strict";
import test from "node:test";

import { expectValid } from "./lint-rule.js";

// eslint-disable-next-line db21-tests/require-justification -- Risk: parser failures make invalid lint fixtures appear as passing rule behavior; Contract: helper fixtures surface fatal parser errors.
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
