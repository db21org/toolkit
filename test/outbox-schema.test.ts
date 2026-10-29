import { execFile } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { withOutboxSchema } from "@db21/toolkit/prisma/outbox/config";
import { afterEach, expect, test } from "vitest";

const directories: string[] = [];
const execute = promisify(execFile);
const concurrentAssemblerCount = 8;

const fixture = (): {
  directory: string;
  source: string;
  assemble: () => string;
} => {
  const directory = mkdtempSync(
    join(realpathSync(tmpdir()), "toolkit-outbox-schema-"),
  );
  const source = join(directory, "prisma/schema");

  directories.push(directory);
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "base.prisma"),
    `
// model OutboxMessage is supplied by toolkit, not this file.
generator client {
  provider = "prisma-client-js"
  output = "../../client"
}
datasource db {
  provider = "postgresql"
}
`,
  );

  return {
    directory,
    source,
    assemble: () =>
      withOutboxSchema({
        baseDirectory: directory,
        source: "prisma/schema",
        output: ".generated/schema",
      }),
  };
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: stale generated models or relocated generators change the deployed schema; Contract: source edits create complete fresh snapshots without mutating source or rewriting unchanged output.
test("schema snapshots track source additions and removals without stale models", () => {
  const { directory, source, assemble } = fixture();
  const model = join(source, "order.prisma");

  writeFileSync(model, "model Order {\n id String @id\n}\n");

  const first = assemble();
  const modifiedAt = statSync(join(first, "base.prisma")).mtimeMs;

  expect(assemble()).toBe(first);
  expect(statSync(join(first, "base.prisma")).mtimeMs).toBe(modifiedAt);
  expect(readFileSync(join(first, "base.prisma"), "utf8")).toContain(
    JSON.stringify(join(directory, "client")),
  );
  expect(readFileSync(join(source, "base.prisma"), "utf8")).toContain(
    'output = "../../client"',
  );
  unlinkSync(model);

  const next = assemble();

  expect(next).not.toBe(first);
  expect(() => statSync(join(next, "order.prisma"))).toThrow();
  expect(readFileSync(join(first, "order.prisma"), "utf8")).toContain(
    "model Order",
  );
  expect(statSync(join(next, "toolkit-outbox.prisma")).isFile()).toBe(true);
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: concurrent Prisma commands observe incomplete schemas; Contract: separate processes assembling one directory receive the same complete immutable snapshot.
test("concurrent assemblers safely publish one complete snapshot", async () => {
  const { directory } = fixture();
  const module = new URL("../dist/prisma/outbox/config.js", import.meta.url)
    .href;
  const code = `import { withOutboxSchema } from ${JSON.stringify(module)}; console.log(withOutboxSchema(${JSON.stringify({ baseDirectory: directory, source: "prisma/schema", output: ".generated/schema" })}));`;
  // eslint-disable-next-line db21-promises/prefer-native-batch -- Independent schema assemblers must race publication; a single batch assembler would not exercise process-level atomicity.
  const results = await Promise.all(
    Array.from({ length: concurrentAssemblerCount }, () =>
      execute(process.execPath, ["--input-type=module", "-e", code], {
        cwd: "/",
      }),
    ),
  );
  const snapshots = new Set(results.map((result) => result.stdout.trim()));

  expect(snapshots.size).toBe(1);

  for (const path of snapshots) {
    expect(statSync(join(path, "base.prisma")).isFile()).toBe(true);
    expect(statSync(join(path, "toolkit-outbox.prisma")).isFile()).toBe(true);
  }
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: assembly overwrites product files or silently composes conflicting schemas; Contract: duplicate models, dynamic outputs, symlinks, unowned output and tampered snapshots are refused without discarding files.
test("unsafe schema composition refuses writes and preserves user content", () => {
  const { directory, source, assemble } = fixture();
  const conflict = join(source, "local.prisma");

  writeFileSync(conflict, "model OutboxMessage {\n id String @id\n}\n");
  expect(assemble).toThrow(/local OutboxMessage/u);
  unlinkSync(conflict);
  symlinkSync(join(source, "base.prisma"), conflict);
  expect(assemble).toThrow(/symlinks/u);
  unlinkSync(conflict);
  writeFileSync(
    conflict,
    'generator custom {\n provider = "custom"\n output = env("OUTPUT")\n}\n',
  );
  expect(assemble).toThrow(/static string/u);
  unlinkSync(conflict);

  const outside = {
    baseDirectory: directory,
    source: "prisma/schema",
    output: "../outside",
  };

  expect(() => withOutboxSchema(outside)).toThrow(/inside/u);
  expect(() =>
    withOutboxSchema({ ...outside, output: "prisma/schema/generated" }),
  ).toThrow(/overlap/u);
  mkdirSync(join(directory, ".generated/schema"), { recursive: true });
  writeFileSync(join(directory, ".generated/schema/user.txt"), "keep");
  expect(assemble).toThrow();
  expect(
    readFileSync(join(directory, ".generated/schema/user.txt"), "utf8"),
  ).toBe("keep");

  const fresh = fixture();
  const snapshot = fresh.assemble();

  writeFileSync(join(snapshot, "base.prisma"), "user edit");
  expect(fresh.assemble).toThrow(/modified/u);
  expect(readFileSync(join(snapshot, "base.prisma"), "utf8")).toBe("user edit");
});
