import assert from "node:assert/strict";
import test from "node:test";

import { commonConfig } from "@db21/toolkit/eslint";
import { rawSqlPolicyPlugin } from "@db21/toolkit/eslint/plugins";
import { Linter } from "eslint";
import tseslint from "typescript-eslint";

const rule = "db21-sql/require-justification";
const reasonRule = "db21-sql/require-local-reason";
const config = {
  plugins: { "db21-sql": rawSqlPolicyPlugin },
  processor: "db21-sql/policy-guard",
  rules: { [rule]: "error", [reasonRule]: "error" },
};
const verify = (code) => new Linter().verify(code, config, "consumer.js");
const explanation =
  "Transaction advisory lock has no equivalent ORM or builder operation.";

// eslint-disable-next-line db21-tests/require-justification -- Risk: raw execution or aliased SQL fragments bypass database behavior review; Contract: representative Prisma and Kysely escape hatches report the policy.
test("raw SQL policy detects execution and imported escape hatches", () => {
  const operations = [
    "prisma.$queryRaw`SELECT ${id}`;",
    "tx.$executeRaw`UPDATE things SET value = ${value}`;",
    'client.$queryRawUnsafe("SELECT $1", id);',
    'client.$executeRawUnsafe("UPDATE things SET value = $1", value);',
    'client["$queryRaw"](query);',
    "client[`$executeRaw`](query);",
    "client?.$queryRaw?.(query);",
    'import { Prisma } from "@prisma/client"; Prisma.sql`SELECT ${id}`;',
    'import { Prisma as P } from "@amatok/database"; P.raw("SELECT 1");',
    'import * as db from "@prisma/client"; db.Prisma.sql`SELECT 1`;',
    'import { Prisma } from "@prisma/client"; Prisma["sql"]`SELECT 1`;',
    'import { sql } from "kysely"; sql`SELECT ${id}`;',
    'import { sql as fragment } from "kysely"; fragment`SELECT 1`;',
    'import * as builder from "kysely"; builder.sql`SELECT 1`;',
    'import { sql } from "kysely"; sql.raw(text);',
    'import { sql } from "kysely"; sql.lit(value);',
    'import { sql } from "kysely"; sql.ref(column);',
    'import { sql } from "kysely"; sql.id(table, column);',
    'import * as builder from "kysely"; builder.sql["raw"](text);',
  ];

  for (const code of operations) {
    assert.deepEqual(
      verify(code).map((message) => message.ruleId),
      [rule],
      code,
    );
  }

  const messages = verify(
    'import { Prisma } from "@prisma/client"; tx.$queryRaw(Prisma.sql`SELECT 1`);',
  );

  assert.deepEqual(
    messages.map((message) => message.ruleId),
    [rule, rule],
  );
  const typescriptMessages = new Linter().verify(
    'import { Prisma as P } from "@amatok/database"; (P.sql!)`SELECT 1`; (tx as Client).$queryRaw(query);',
    { ...config, languageOptions: { parser: tseslint.parser } },
    "consumer.js",
  );

  assert.deepEqual(
    typescriptMessages.map((message) => message.ruleId),
    [rule, rule],
  );
  const presetMessages = new Linter().verify(
    "client.$queryRaw`SELECT 1`;",
    commonConfig,
    "consumer.mjs",
  );

  assert.equal(
    presetMessages.some((message) => message.fatal),
    false,
  );
  assert.ok(presetMessages.some((message) => message.ruleId === rule));
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: normal builders or shadowed bindings require blanket SQL-policy exceptions; Contract: representative unrelated operations remain lint-clean.
test("raw SQL policy leaves typed builders and unrelated bindings alone", () => {
  const operations = [
    "prisma.user.findMany({ where: { id } });",
    'db.selectFrom("users").select("id").where("id", "=", id).execute();',
    'import { Prisma } from "@prisma/client"; Prisma.join(ids);',
    'import { Prisma } from "@prisma/client"; Prisma[`${method}`](query);',
    'import { sql } from "kysely"; sql.join(values); sql.val(value);',
    'import { sql } from "unrelated"; sql`not SQL`; sql.raw(value);',
    'import { raw } from "unrelated"; raw(value);',
    'import { sql } from "kysely"; function local(sql) { return sql`local`; }',
    'import { Prisma } from "@prisma/client"; function local(Prisma) { return Prisma.sql`local`; }',
    'import * as builder from "kysely"; builder.other(value);',
    "const sql = (value) => value; sql`local`;",
    "const Prisma = { sql: (value) => value }; Prisma.sql`local`;",
    "client[method](query);",
    'client["$query" + "Raw"](query);',
  ];

  for (const code of operations) {
    assert.deepEqual(verify(code), [], code);
  }

  const messages = new Linter().verify(
    'import helper = require("helper"); helper.sql`local`;',
    { ...config, languageOptions: { parser: tseslint.parser } },
    "consumer.js",
  );

  assert.deepEqual(messages, []);
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: missing, blanket, or downgraded exceptions make raw SQL review optional; Contract: only local explained error-level exceptions suppress the policy.
test("raw SQL exceptions require local reasons and retain error severity", () => {
  const operation = "tx.$queryRaw`SELECT 1`;";

  for (const code of [
    `// eslint-disable-next-line ${rule} -- ${explanation}\n${operation}`,
    `${operation} // eslint-disable-line ${rule} -- ${explanation}`,
  ]) {
    assert.deepEqual(verify(code), [], code);
  }

  for (const directive of [
    `// eslint-disable-next-line ${rule}`,
    `// eslint-disable-next-line ${rule} -- performance`,
    `/* eslint-disable ${rule} -- ${explanation} */`,
    `/* eslint ${rule}: off */`,
    `/* eslint "${rule}": "warn" */`,
    `/* eslint '${rule}': 0 */`,
    `/* eslint ${rule}: 1 */`,
    `/* eslint ${rule}: ["off"] */`,
    `/* eslint ${rule}: [1] -- ${explanation} */`,
    `/* eslint no-alert: error, "${rule}": ["warn"] */`,
    `/* eslint "${rule}": "error", "${rule}": "off" */`,
    `/* eslint\n "${rule}": 0\n*/`,
  ]) {
    const messages = verify(`${directive}\n${operation}`);

    assert.ok(
      messages.some((message) => message.ruleId === reasonRule),
      directive,
    );
  }

  for (const setting of ['"error"', "error", "2", '["error"]', "[2]"]) {
    assert.deepEqual(
      verify(
        `/* eslint "${rule}": ${setting} */\n// eslint-disable-next-line ${rule} -- ${explanation}\n${operation}`,
      ),
      [],
      setting,
    );
  }

  assert.deepEqual(
    verify(
      `// eslint-disable-next-line ${rule} -- ${explanation}\n${operation}\n${operation}`,
    ).map((message) => message.ruleId),
    [rule],
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: a single directive silently disables SQL review and its validator; Contract: processor diagnostics survive rule suppressions without flagging text inside strings.
test("SQL guard cannot be suppressed by disabling its policy rules", () => {
  const operation = "tx.$queryRaw`SELECT 1`;";

  for (const directive of [
    `/* eslint-disable ${rule}, ${reasonRule} */`,
    `// eslint-disable-next-line ${rule}, ${reasonRule}`,
    `/* eslint "${rule}": "off", "${reasonRule}": "off" */`,
    `/* eslint "${reasonRule}": [1] */`,
    `/* eslint-disable db21-sql/protected-validator, ${reasonRule}, ${rule} */`,
  ]) {
    const messages = verify(`${directive}\n${operation}`);

    assert.ok(
      messages.some(
        (message) => message.ruleId === "db21-sql/protected-validator",
      ),
      directive,
    );
  }

  assert.deepEqual(
    verify(`const text = "/* eslint-disable ${reasonRule} */";`),
    [],
  );
  const presetMessages = new Linter().verify(
    `/* eslint-disable ${rule}, ${reasonRule} */\n${operation}`,
    commonConfig,
    "consumer.mjs",
  );

  assert.ok(
    presetMessages.some(
      ({ ruleId }) => ruleId === "db21-sql/protected-validator",
    ),
  );
});
