import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { URL } from "node:url";

import { createRegistry, defineEvent } from "@db21/toolkit/events";
import { Application, inspectModule, Module } from "@db21/toolkit/feature-kit";
import { reactProvider } from "@db21/toolkit/feature-kit/react";
import { createMoney, serializeMoney } from "@db21/toolkit/money";
import { isEmpty } from "@db21/toolkit/utils";
import { z } from "zod";

const require = createRequire(import.meta.url);
const metadata = {
  eventId: "4423fb0f-848d-4e34-a71f-01b609b1e7cf",
  occurredAt: "2026-08-21T12:00:00.000Z",
};

for (const events of [
  { createRegistry, defineEvent },
  require("@db21/toolkit/events"),
]) {
  const definition = events.defineEvent("ping", "system.ping", 1, z.object({}));
  const registry = events.createRegistry([definition]);
  const event = registry.createEvent(registry.eventTypes.ping, metadata);

  assert.deepEqual(event, { ...metadata, type: "system.ping", version: 1 });
  assert.equal(registry.safeParseEvent("system.ping", event).success, true);
}

const exports = JSON.parse(
  readFileSync(new URL("./exports.json", import.meta.url), "utf8"),
);

for (const subpath of Object.keys(exports)) {
  const specifier = `@db21/toolkit${subpath.slice(1)}`;

  if (subpath.endsWith(".json")) {
    assert.equal(
      typeof JSON.parse(readFileSync(require.resolve(specifier), "utf8")),
      "object",
    );
  } else {
    const entry = await import(specifier);

    assert.ok(Object.keys(entry).length);
  }
}

assert.equal(isEmpty([]), true);
const money = createMoney("12.34", "USD");

assert.ok(money);
assert.deepEqual(serializeMoney(money), { amount: "12.34", currency: "USD" });
assert.equal(require("@db21/toolkit/utils").isEmpty([]), true);
assert.equal(
  require("@db21/toolkit/money").createMoney("12.34", "USD").amount.toString(),
  "12.34",
);
assert.throws(() => require.resolve("@db21/toolkit"), {
  code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
});
assert.throws(() => require.resolve("@db21/toolkit/dist/utils/index.js"), {
  code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
});

const provider = reactProvider({
  dependencies: {},
  component: ({ children }) => children,
});

class ConsumerModule {}

Module({ reactProviders: [provider] })(ConsumerModule);
assert.deepEqual(inspectModule(ConsumerModule).reactProviders, [provider]);
const application = Application.create(ConsumerModule);

await application.dispose();

const packageRoot = dirname(
  dirname(dirname(require.resolve("@db21/toolkit/utils"))),
);

for (const path of [
  "actions/setup-yarn/action.yml",
  "actions/prepare-turbo-workspace/action.yml",
  "actions/publish-image/action.yml",
  "actions/record-image-release/action.yml",
  "actions/record-image-release/record.mjs",
  "actions/collect-image-releases/action.yml",
  "actions/collect-image-releases/collect.mjs",
  "actions/select-image-builds/action.yml",
  "actions/select-image-builds/select.mjs",
  "actions/submit-deployment/action.yml",
  "actions/submit-deployment/submit.sh",
  "docs/github-actions.md",
  "LICENSE",
  "NOTICE",
  "README.md",
]) {
  assert.equal(
    existsSync(join(packageRoot, path)),
    true,
    `Missing packed file: ${path}`,
  );
}

assert.equal(existsSync(join(packageRoot, "src")), false);
assert.equal(existsSync(join(packageRoot, "test")), false);

for (const path of readdirSync(packageRoot, { recursive: true })) {
  assert.equal(path.endsWith(".map"), false, `Source map leaked: ${path}`);
  assert.equal(
    /\.(?:ts|tsx|mts|cts)$/u.test(path) && !/\.d\.(?:ts|mts|cts)$/u.test(path),
    false,
    `Original TypeScript leaked: ${path}`,
  );
}

const manifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
);

assert.notEqual(manifest.private, true);
assert.equal(manifest.publishConfig.access, "public");
assert.notEqual(manifest.publishConfig.provenance, false);
