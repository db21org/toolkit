import assert from "node:assert/strict";

import { exportedConstantNamingPlugin } from "@db21/toolkit/eslint/plugins";
import { ESLint } from "eslint";
import typescriptEslint from "typescript-eslint";
import { test } from "vitest";

const targetRule = "db21-constants/exported-constant-naming";
const eslint = new ESLint({
  ignore: false,
  overrideConfig: [
    {
      files: ["**/*.ts"],
      languageOptions: { parser: typescriptEslint.parser },
      plugins: { "db21-constants": exportedConstantNamingPlugin },
      rules: { [targetRule]: "error" },
    },
  ],
  overrideConfigFile: true,
});

const lint = async (source) => {
  const [result] = await eslint.lintText(source, { filePath: "fixture.ts" });

  return result.messages.filter((message) => message.ruleId === targetRule);
};

// eslint-disable-next-line db21-tests/require-justification -- Primitive public constants need screaming-snake names so configuration-like exports are distinguishable from runtime values.
test("rejects camelCase exported primitive literal constants", async () => {
  for (const source of [
    'export const apiUrl = "https://example.test";',
    "export const retryCount = 3;",
    "export const featureEnabled = true;",
    "export const version = `v1`;",
    'export const namespace = "app" as const;',
    'const publicName = "market"; export { publicName };',
  ]) {
    const messages = await lint(source);

    assert.equal(messages.length, 1);
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Runtime-derived exports and semantic object names must remain legal so the naming rule does not force misleading constant-style APIs.
test("allows uppercase literals and semantic runtime exports", async () => {
  for (const source of [
    'export const API_URL = "https://example.test";',
    'const publicName = "market"; export { publicName as PUBLIC_NAME };',
    "export const apiClient = createClient();",
    "export const apiServerAddress = config.server.address;",
    "export const version = `v${majorVersion}`;",
    'const localValue = "local";',
    "export const RuntimeKind = { server: 'server' } as const;",
  ]) {
    const messages = await lint(source);

    assert.deepEqual(messages, []);
  }
});
