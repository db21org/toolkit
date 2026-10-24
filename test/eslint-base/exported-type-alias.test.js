import assert from "node:assert/strict";
import test from "node:test";

import {
  typescriptRepositoryPlugins,
  typescriptRepositoryRules,
} from "@db21/toolkit/eslint";
import { exportedTypeAliasPlugin } from "@db21/toolkit/eslint/plugins";
import { Linter } from "eslint";
import tseslint from "typescript-eslint";

const rule = "db21-type-aliases/no-redundant-alias";
const verify = (source) =>
  new Linter().verify(
    source,
    [
      {
        files: ["**/*.ts"],
        languageOptions: { parser: tseslint.parser },
        plugins: { "db21-type-aliases": exportedTypeAliasPlugin },
        rules: { [rule]: "error" },
      },
    ],
    "consumer.ts",
  );

// eslint-disable-next-line db21-tests/require-justification -- Risk: identity renames create misleading public type contracts and maintenance indirection; Contract: exported plain aliases report once while original-type reexports and meaningful composition or specialization remain valid.
test("exported identity aliases must use original type names", () => {
  const rejected = [
    "export type GenerationResult = ArticleGeneration;",
    "export type GenerationResult = Domain.ArticleGeneration;",
    "type GenerationResult = ArticleGeneration; export type { GenerationResult };",
    "type GenerationResult = ArticleGeneration; export { GenerationResult };",
    "type GenerationResult = ArticleGeneration; export type { GenerationResult }; export type { GenerationResult as AnotherResult };",
  ];

  for (const source of rejected) {
    assert.deepEqual(
      verify(source).map((message) => message.ruleId),
      [rule],
      source,
    );
  }

  const permitted = [
    'export type { ArticleGeneration } from "./domain";',
    "type GenerationResult = ArticleGeneration;",
    "export type GenerationResult = ArticleGeneration & { readonly attempt: number };",
    "export type GenerationResult = ArticleGeneration | GenerationError;",
    "export type GenerationResult = Pick<ArticleGeneration, 'id'>;",
    "export type GenerationResult = Promise<ArticleGeneration>;",
    "export type GenerationResult<T> = ArticleGeneration<T>;",
    "export type Identifier = string; export type EmptySurfaceProps = undefined;",
    "export interface GenerationResult extends ArticleGeneration {}",
  ];

  for (const source of permitted) {
    assert.deepEqual(verify(source), [], source);
  }

  assert.equal(typescriptRepositoryRules[rule], "error");
  assert.equal(
    typescriptRepositoryPlugins["db21-type-aliases"],
    exportedTypeAliasPlugin,
  );
});
