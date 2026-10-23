import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assert } from "@db21/toolkit/utils";

import { containsPath, readSchemaFiles } from "./schema-files.js";
import { publishSchema } from "./schema-output.js";

type OutboxSchemaOptions = Readonly<{
  baseDirectory: string;
  source: string;
  output: string;
}>;

/**
 * Assembles local schemas plus the bundled outbox without touching the database.
 * @param options Explicit configuration directory, source and generated output.
 * @param options.baseDirectory Directory containing the Prisma configuration.
 * @param options.source Product schema directory relative to the base.
 * @param options.output Dedicated generated directory relative to the base.
 * @returns Immutable schema snapshot directory for Prisma configuration.
 */
export const withOutboxSchema = ({
  baseDirectory,
  source,
  output,
}: OutboxSchemaOptions): string => {
  const base = realpathSync(baseDirectory);
  const sourceDirectory = resolve(base, source);
  const outputDirectory = resolve(base, output);

  assert.true(
    containsPath(base, sourceDirectory) && containsPath(base, outputDirectory),
    "Schema source and output must remain inside the configuration directory.",
  );
  assert.false(
    containsPath(sourceDirectory, outputDirectory) ||
      containsPath(outputDirectory, sourceDirectory),
    "Schema source and output directories must not overlap.",
  );
  assert.true(
    realpathSync(sourceDirectory) === sourceDirectory,
    "Schema source paths must not contain symlinks.",
  );

  const files = readSchemaFiles(sourceDirectory);

  assert.true(
    files.size > 0,
    "Product schema directory must contain Prisma schema files.",
  );
  assert.false(
    [...files.keys()].some(
      (name) => name.toLowerCase() === "toolkit-outbox.prisma",
    ),
    "Reserved toolkit-outbox.prisma filename already exists.",
  );

  const bundledSchema =
    typeof __dirname === "string"
      ? resolve(__dirname, "../../../prisma/outbox.prisma")
      : fileURLToPath(
          new URL("../../../prisma/outbox.prisma", import.meta.url),
        );
  const outbox = readFileSync(bundledSchema, "utf8");

  files.set("toolkit-outbox.prisma", outbox);

  return publishSchema(outputDirectory, files);
};
