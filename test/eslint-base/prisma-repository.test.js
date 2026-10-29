import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { commonConfig } from "@db21/toolkit/eslint";
import { prismaRepositoryPlugin } from "@db21/toolkit/eslint/plugins";
import { isNotEmpty } from "@db21/toolkit/utils";
import { Linter } from "eslint";
import tseslint from "typescript-eslint";

const rule = "db21-prisma/repository-only";
const storageAccessLine = 5;
const transactionAccessLine = 6;
const detachedDelegateAccessLine = 7;
const copiedClientAccessLine = 8;
const serviceClientAccessLine = 11;
const forbiddenTypedClientLines = [
  storageAccessLine,
  transactionAccessLine,
  detachedDelegateAccessLine,
  copiedClientAccessLine,
  serviceClientAccessLine,
];

const config = {
  languageOptions: { parser: tseslint.parser },
  plugins: { "db21-prisma": prismaRepositoryPlugin },
  rules: { [rule]: "error" },
};

const verify = (code, filename = "catalog.service.ts", options = {}) =>
  new Linter().verify(
    code,
    [
      {
        ...config,
        files: ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"],
        rules: { [rule]: ["error", options] },
      },
    ],
    filename,
  );

const assertRejected = (code) => {
  const messages = verify(code);

  assert.ok(isNotEmpty(messages), code);
  assert.ok(
    messages.every((message) => message.ruleId === rule),
    JSON.stringify(messages),
  );
};

// eslint-disable-next-line db21-tests/require-justification -- Risk: aliases or direct Prisma APIs bypass repository ownership; Contract: runtime imports, exports and reserved API access fail outside repositories, including shared preset use.
test("Prisma runtime entry points require repository ownership", () => {
  const rejected = [
    'import { PrismaClient as Client } from "@prisma/client"; new Client();',
    'import { PrismaService as Database } from "#modules/database";',
    'import { createPrismaClient as create } from "@project/database";',
    'import { Prisma as P } from "./generated/client"; P.sql`SELECT 1`;',
    'import * as client from "@prisma/client";',
    'import client from "@prisma/client";',
    'export { PrismaClient as Client } from "@project/database";',
    'export * from "@prisma/client";',
    'export * as database from "@prisma/client";',
    'const client = require("@prisma/client");',
    'const client = await import("@prisma/client");',
    'import client = require("@prisma/client");',
    "store.$transaction(async (transaction) => transaction.user.findMany());",
    "store?.$connect?.();",
    'store["$disconnect"]();',
    "store[`$extends`](extension);",
    "store.$queryRaw`SELECT 1`;",
    "const { $executeRaw: execute } = store;",
  ];

  for (const code of rejected) {
    assertRejected(code);
  }

  const messages = new Linter().verify(
    'import { PrismaClient } from "@prisma/client";',
    commonConfig,
    "service.mjs",
  );

  assert.ok(messages.some((message) => message.ruleId === rule));
  assert.equal(
    messages.some((message) => message.fatal),
    false,
  );
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: boundary enforcement blocks legitimate repository, infrastructure or type contracts; Contract: explicit setup exceptions and type-only use pass without granting arbitrary files implicit access.
test("Prisma policy preserves types and explicit infrastructure exceptions", () => {
  const code =
    'import { PrismaClient } from "@prisma/client"; new PrismaClient().$connect();';

  for (const extension of [
    "ts",
    "tsx",
    "mts",
    "cts",
    "js",
    "jsx",
    "mjs",
    "cjs",
  ]) {
    assert.deepEqual(verify(code, `src/catalog.repository.${extension}`), []);
  }

  assert.deepEqual(verify(code, "src/database/setup.ts", { allow: true }), []);
  assertRejected(code);
  assert.deepEqual(
    verify('import { Store } from "./database";', "service.ts", {
      clientNames: ["Store"],
    }).map((message) => message.ruleId),
    [rule],
  );
  const permitted = [
    'import type { PrismaClient, Prisma, PrismaService } from "@project/database";',
    'import { type Prisma, Status } from "@prisma/client";',
    'export type { PrismaClient } from "@prisma/client";',
    'export type * from "@prisma/client";',
    'import type Client = require("@prisma/client");',
    'import { ArticleRepository } from "./article.repository"; repository.findMany();',
    'function run(require) { return require("@prisma/client"); }',
    "const text = 'prisma.$transaction()';",
    "client.findMany(); builder.selectFrom('users').execute();",
  ];

  for (const source of permitted) {
    assert.deepEqual(verify(source), [], source);
  }
});

const createTypedFixture = () => {
  const directory = mkdtempSync(join(tmpdir(), "toolkit-prisma-policy-"));

  try {
    symlinkSync(
      resolve("node_modules"),
      join(directory, "node_modules"),
      "dir",
    );
    writeFileSync(
      join(directory, "schema.prisma"),
      `generator client {
  provider = "prisma-client-js"
  output = "./generated"
}
datasource db {
  provider = "postgresql"
}
model User {
  id String @id
}
`,
    );
    writeFileSync(
      join(directory, "prisma.config.ts"),
      'export default { schema: "./schema.prisma" };',
    );
    writeFileSync(
      join(directory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          skipLibCheck: true,
        },
        include: ["*.ts"],
      }),
    );
    execFileSync(
      process.execPath,
      [
        resolve("node_modules/prisma/build/index.js"),
        "generate",
        "--config",
        join(directory, "prisma.config.ts"),
      ],
      {
        cwd: directory,
        stdio: "pipe",
        env: { ...process.env, CI: "true", PRISMA_GENERATE_NO_HINTS: "true" },
      },
    );

    return directory;
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });

    throw error;
  }
};

const typedClientSource = `import type { PrismaClient, Prisma } from "./generated";
declare const storage: PrismaClient;
declare const transaction: Prisma.TransactionClient;
declare const detached: Prisma.UserDelegate;
storage.user.findMany();
transaction.user.findUnique({ where: { id: "one" } });
detached.findMany();
const copy = storage;
class Service {
  constructor(private readonly database: PrismaClient) {}
  run() { return this.database.user.findMany(); }
}
interface OtherDelegate { findMany(): void; findUnique(): void; }
declare const ordinary: OtherDelegate;
ordinary.findMany();
type Instance = InstanceType<typeof PrismaClient>;
type Delegate = typeof detached;
type Query = typeof storage.user.findMany;
`;

// eslint-disable-next-line db21-tests/require-justification -- Risk: type-only injection, renamed clients or detached delegates evade import checks; Contract: real generated Prisma types reveal client and transaction access while normal lookalike methods and type references remain allowed.
test("typed Prisma clients and detached delegates cannot escape repositories", () => {
  const directory = createTypedFixture();

  try {
    const filename = join(directory, "service.ts");

    writeFileSync(filename, typedClientSource);
    const messages = new Linter({ cwd: directory }).verify(
      typedClientSource,
      [
        {
          ...config,
          files: ["**/*.ts"],
          languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
              project: join(directory, "tsconfig.json"),
              tsconfigRootDir: directory,
            },
          },
        },
      ],
      { filename },
    );

    for (const line of forbiddenTypedClientLines) {
      assert.ok(
        messages.some(
          (message) => message.ruleId === rule && message.line === line,
        ),
        JSON.stringify(messages),
      );
    }

    assert.ok(
      messages.every(
        (message) =>
          message.ruleId === rule &&
          forbiddenTypedClientLines.includes(message.line),
      ),
      JSON.stringify(messages),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
