import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";

import { outboxExtension } from "@db21/toolkit/prisma/outbox";
import { withOutboxSchema } from "@db21/toolkit/prisma/outbox/config";
import { PrismaPg } from "@prisma/adapter-pg";

const root = resolve(import.meta.dirname, "../..");
const productSchema = `
generator client {
  provider = "prisma-client-js"
  output = "../../client"
}
datasource db {
  provider = "postgresql"
}
model Order {
  id String @id
}
`;

const checkConsumerTypes = (directory, run) => {
  for (const extension of ["js", "cjs"]) {
    const file = join(
      directory,
      `consumer.${extension === "js" ? "mts" : "cts"}`,
    );
    const entry = join(root, `dist/prisma/outbox/index.${extension}`);

    writeFileSync(
      file,
      `
import { PrismaClient } from "./client/index.js";
import { outboxExtension, type OutboxClaim } from ${JSON.stringify(entry)};
declare const original: PrismaClient;
const client = original.$extends(outboxExtension());
async function persist(): Promise<void> {
  await client.$transaction(async (tx) => {
    await tx.order.create({ data: { id: "order" } });
    await tx.outboxMessage.enqueue({ topic: "created", aggregateType: "Order", aggregateId: "order", deduplicationKey: "event", payload: { id: "event" } });
    const claims: readonly OutboxClaim[] = await tx.outboxMessage.claim({ topic: "created", limit: 1, leaseSeconds: 30 });
    // @ts-expect-error Claim limits are numeric, not strings.
    await tx.outboxMessage.claim({ topic: "created", limit: "1", leaseSeconds: 30 });
    // @ts-expect-error Domain transactions cannot omit the deduplication key.
    await tx.outboxMessage.enqueue({ topic: "created", aggregateType: "Order", aggregateId: "order", payload: {} });
    for (const claim of claims) {
      await tx.outboxMessage.complete({ ...claim, reason: "delivered" });
      await tx.outboxMessage.markFailed({ ...claim, error: "offline", retryAt: new Date() });
    }
  });
}
`,
    );
    run(process.execPath, [
      join(root, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--module",
      "NodeNext",
      "--target",
      "ES2022",
      file,
    ]);
  }
};

const waitForPostgres = async (run, container) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      run("docker", ["exec", container, "pg_isready", "-U", "postgres"]);

      return;
    } catch (error) {
      assert.ok(
        attempt < 60,
        `Disposable PostgreSQL did not become ready: ${String(error)}`,
      );
      await setTimeout(250);
    }
  }
};

const prepareClient = (directory, connectionString, run) => {
  symlinkSync(
    join(root, "node_modules"),
    join(directory, "node_modules"),
    "dir",
  );
  mkdirSync(join(directory, "prisma/schema"), { recursive: true });
  writeFileSync(join(directory, "prisma/schema/base.prisma"), productSchema);

  const schema = withOutboxSchema({
    baseDirectory: directory,
    source: "prisma/schema",
    output: ".generated/schema",
  });
  const config = join(directory, "prisma.config.mjs");
  const migrations = join(directory, "prisma/migrations");
  const migration = join(migrations, "20260101000000_init/migration.sql");

  mkdirSync(join(migrations, "20260101000000_init"), { recursive: true });
  writeFileSync(
    join(migrations, "migration_lock.toml"),
    'provider = "postgresql"\n',
  );

  writeFileSync(
    config,
    `export default ${JSON.stringify({ schema, datasource: { url: connectionString }, migrations: { path: migrations } })};`,
  );

  for (const args of [
    ["generate"],
    [
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema",
      schema,
      "--script",
      "--output",
      migration,
    ],
    ["migrate", "deploy"],
  ]) {
    run(process.execPath, [
      join(root, "node_modules/prisma/build/index.js"),
      ...args,
      "--config",
      config,
    ]);
  }

  checkConsumerTypes(directory, run);

  const { PrismaClient } = createRequire(join(directory, "package.json"))(
    join(directory, "client"),
  );

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  }).$extends(outboxExtension());
};

const startPostgres = async (container, run) => {
  const password = randomUUID();

  run(
    "docker",
    [
      "run",
      "--detach",
      "--rm",
      "--name",
      container,
      "--publish",
      "127.0.0.1::5432",
      "--env",
      "POSTGRES_PASSWORD",
      "postgres:17-alpine",
    ],
    { env: { ...process.env, POSTGRES_PASSWORD: password } },
  );
  await waitForPostgres(run, container);

  const port = run("docker", ["port", container, "5432/tcp"])
    .trim()
    .split(":")
    .at(-1);

  return `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`;
};

export const createPostgresFixture = async () => {
  const directory = mkdtempSync(join(tmpdir(), "toolkit-outbox-postgres-"));
  const container = `toolkit-outbox-${randomUUID()}`;
  const run = (command, args, options = {}) =>
    execFileSync(command, args, {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
      ...options,
    });
  let prisma;

  const dispose = async () => {
    try {
      await prisma?.$disconnect();
    } finally {
      try {
        run("docker", ["rm", "--force", container]);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  };

  try {
    const connectionString = await startPostgres(container, run);

    prisma = prepareClient(directory, connectionString, run);

    return { prisma, dispose };
  } catch (error) {
    await dispose();

    throw error;
  }
};
