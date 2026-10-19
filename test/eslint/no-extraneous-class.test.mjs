import assert from "node:assert/strict";

import { ESLint } from "eslint";
import typescriptEslint from "typescript-eslint";
import { test } from "vitest";

const eslint = new ESLint({
  ignore: false,
  overrideConfig: [
    {
      files: ["**/*.ts"],
      languageOptions: {
        parser: typescriptEslint.parser,
        parserOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
        },
      },
      plugins: {
        "@typescript-eslint": typescriptEslint.plugin,
      },
      rules: {
        "@typescript-eslint/no-extraneous-class": [
          "error",
          { allowStaticOnly: true, allowWithDecorator: true },
        ],
      },
    },
  ],
  overrideConfigFile: true,
});

const FILE_PATH = "fixture.ts";

const targetRule = "@typescript-eslint/no-extraneous-class";

const lint = async (source) => {
  const [result] = await eslint.lintText(source, {
    filePath: FILE_PATH,
  });

  return result.messages.filter((message) => message.ruleId === targetRule);
};

test("allows decorated empty TypeScript classes", async () => {
  const messages = await lint(
    [
      "function decoratorFactory(): ClassDecorator {",
      "  return () => {};",
      "}",
      "",
      "@decoratorFactory()",
      "export class ModuleFixture {}",
      "",
    ].join("\n"),
  );

  assert.deepEqual(messages, []);
});

test("reports undecorated empty TypeScript classes", async () => {
  const messages = await lint("export class PlainFixture {}\n");

  assert.deepEqual(messages.length, 1);
  assert.equal(messages[0].ruleId, targetRule);
});

test("allows static-only TypeScript classes", async () => {
  const messages = await lint(
    [
      "export class MapperFixture {",
      "  public static map(value: string): string {",
      "    return value;",
      "  }",
      "}",
      "",
    ].join("\n"),
  );

  assert.deepEqual(messages, []);
});
