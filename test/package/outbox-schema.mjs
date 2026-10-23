import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { withOutboxSchema } from "@db21/toolkit/prisma/outbox/config";

const require = createRequire(import.meta.url);
const source = join(import.meta.dirname, "prisma/schema");

mkdirSync(source, { recursive: true });
writeFileSync(
  join(source, "base.prisma"),
  'datasource db {\n provider = "postgresql"\n}\n',
);

const options = {
  baseDirectory: import.meta.dirname,
  source: "prisma/schema",
  output: ".generated/schema",
};
const snapshot = withOutboxSchema(options);
const commonJsSnapshot =
  require("@db21/toolkit/prisma/outbox/config").withOutboxSchema(options);

assert.equal(commonJsSnapshot, snapshot);
assert.equal(
  readFileSync(join(snapshot, "base.prisma"), "utf8"),
  readFileSync(join(source, "base.prisma"), "utf8"),
);
assert.ok(
  readFileSync(join(snapshot, "toolkit-outbox.prisma"), "utf8").includes(
    "model OutboxMessage",
  ),
);
