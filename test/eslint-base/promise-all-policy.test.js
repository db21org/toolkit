import assert from "node:assert/strict";
import test from "node:test";

import commonConfig from "@db21/toolkit/eslint";
import {
  promiseAllPolicyPlugin,
  rawSqlPolicyPlugin,
} from "@db21/toolkit/eslint/plugins";
import { Linter } from "eslint";
import tseslint from "typescript-eslint";

const rule = "db21-promises/prefer-native-batch";
const reasonRule = "db21-promises/require-local-reason";
const maximumLinesForProcessorValidation = 3;
const explanation =
  "Independent worker processes must overlap to exercise the lock race; a batch API would bypass it.";

const config = {
  languageOptions: { parser: tseslint.parser },
  plugins: {
    "db21-promises": promiseAllPolicyPlugin,
    "db21-sql": rawSqlPolicyPlugin,
  },
  processor: "db21-sql/policy-guard",
  rules: { [rule]: "error", [reasonRule]: "error" },
};
const verify = (code) => new Linter().verify(code, config, "consumer.mjs");
const awaitedCalls = [
  "await Promise.all(tasks);",
  "await Promise['all'](tasks);",
  "await Promise[`all`](tasks);",
  "await Promise?.all?.(tasks);",
  "async function load() { return await Promise.all(tasks); }",
  "await (Promise.all(tasks) as Promise<unknown[]>);",
  "await (Promise as PromiseConstructor).all(tasks);",
  "await Promise.all!(tasks);",
];

const unrelated = [
  "await service.loadMany(ids);",
  "await Promise.allSettled(tasks);",
  "await Promise.race(tasks);",
  "const batch = Promise.all(tasks); await batch;",
  "function run() { return Promise.all(tasks); }",
  "async function run(Promise) { await Promise.all(tasks); }",
  "import Promise from 'custom'; await Promise.all(tasks);",
  "const Promise = service; await Promise.all(tasks);",
  "await Promise[method](tasks);",
  "await Promise[`all${suffix}`](tasks);",
];

const assertExceptions = () => {
  for (const code of [
    `// eslint-disable-next-line ${rule} -- ${explanation}\nawait Promise.all(tasks);`,
    `await Promise.all(tasks); // eslint-disable-line ${rule} -- ${explanation}`,
  ]) {
    assert.deepEqual(verify(code), []);
  }

  for (const directive of [
    `// eslint-disable-next-line ${rule}`,
    `// eslint-disable-next-line ${rule} -- required`,
    `/* eslint-disable ${rule} -- ${explanation} */`,
    `/* eslint "${rule}": "off" */`,
    `/* eslint '${rule}': [1] */`,
    `/* eslint "${rule}": 2, "${rule}": 0 */`,
  ]) {
    assert.ok(
      verify(`${directive}\nawait Promise.all(tasks);`).some(
        ({ ruleId }) => ruleId === reasonRule,
      ),
      directive,
    );
  }

  for (const directive of [
    `/* eslint-disable ${rule}, ${reasonRule} -- ${explanation} */`,
    `/* eslint "${rule}": "off", "${reasonRule}": "off" */`,
    `/* eslint-disable db21-promises/protected-validator, ${reasonRule} */`,
  ]) {
    assert.ok(
      verify(`${directive}\nawait Promise.all(tasks);`).some(
        ({ ruleId }) => ruleId === "db21-promises/protected-validator",
      ),
      directive,
    );
  }
};

const assertSharedProcessors = () => {
  const shared = [
    ...commonConfig,
    tseslint.configs.disableTypeChecked,
    {
      rules: {
        "max-lines": ["error", { max: maximumLinesForProcessorValidation }],
      },
    },
  ];

  for (const extension of [
    "js",
    "jsx",
    "mjs",
    "cjs",
    "ts",
    "tsx",
    "mts",
    "cts",
  ]) {
    const filename = `consumer.${extension}`;

    for (const prefix of ["db21-promises", "db21-sql"]) {
      const primary =
        prefix === "db21-promises" ? rule : "db21-sql/require-justification";
      const source = `/* eslint "${primary}": "off", "${prefix}/require-local-reason": "off" */\nasync function run() { await Promise.all(tasks); }`;
      const messages = new Linter().verify(source, shared, filename);

      assert.equal(
        messages.some(({ fatal }) => fatal),
        false,
        filename,
      );
      assert.ok(
        messages.some(
          ({ ruleId }) => ruleId === `${prefix}/protected-validator`,
        ),
        filename,
      );
    }

    const justified = new Linter().verify(
      `// eslint-disable-next-line ${rule} -- ${explanation}\nasync function run() { await Promise.all(tasks); }`,
      shared,
      filename,
    );

    assert.equal(
      justified.some(({ ruleId }) => ruleId?.startsWith("db21-promises/")),
      false,
      filename,
    );

    const sizeMessages = new Linter().verify(
      "const first = 1;\nconst second = 2;\nconst third = 3;\nconst fourth = 4;",
      shared,
      filename,
    );
    const size = sizeMessages.find(({ ruleId }) => ruleId === "max-lines");

    assert.ok(size, filename);
    assert.match(size.message, /Refactor into cohesive modules/u, filename);
  }
};

// eslint-disable-next-line db21-tests/require-justification -- Risk: preset composition permits unjustified fan-out or blocks legitimate worker races and unrelated APIs; Contract: shared policy reports awaited global Promise.all, preserves scoped justified exceptions and rejects attempts to disable their validator.
test("native batch policy enforces awaited fan-out and local explanations", () => {
  for (const code of awaitedCalls) {
    assert.deepEqual(
      verify(code).map(({ ruleId }) => ruleId),
      [rule],
      code,
    );
  }

  for (const code of unrelated) {
    assert.deepEqual(verify(code), [], code);
  }

  assertExceptions();
  assertSharedProcessors();
  assert.deepEqual(
    verify(`const text = '/* eslint-disable ${reasonRule} */';`),
    [],
  );
  const messages = new Linter().verify(
    "await Promise.all(tasks);",
    commonConfig,
    "consumer.mjs",
  );

  assert.equal(
    messages.some(({ fatal }) => fatal),
    false,
  );
  assert.ok(messages.some(({ ruleId }) => ruleId === rule));
});
