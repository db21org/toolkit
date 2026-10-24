import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { createMoney } from "@db21/toolkit/money";
import { isEmpty } from "@db21/toolkit/utils";

const require = createRequire(import.meta.url);

assert.equal(isEmpty([]), true);
assert.equal(createMoney("12.34", "USD").amount.toString(), "12.34");
assert.equal(require("@db21/toolkit/utils").isEmpty([]), true);
assert.equal(
  require("@db21/toolkit/money").createMoney("12.34", "USD").amount.toString(),
  "12.34",
);

// React Hooks diagnostics bring Zod transitively; it is not an absent-host contract.
for (const host of ["react", "eslint", "@prisma/client"]) {
  assert.throws(
    () => require.resolve(host),
    { code: "MODULE_NOT_FOUND" },
    host,
  );
}
