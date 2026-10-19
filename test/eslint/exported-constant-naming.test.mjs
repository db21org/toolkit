import assert from "node:assert/strict";

import { ESLint } from "eslint";
import typescriptEslint from "typescript-eslint";
import { test } from "vitest";

import { exportedConstantNamingPlugin } from "../../src/eslint/plugins/index.mjs";

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
