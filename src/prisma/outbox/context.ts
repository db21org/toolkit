import { assert } from "@db21/toolkit/utils";
import { Prisma } from "@prisma/client/extension";

import type { EnqueueOutboxMessage } from "./types.js";

type OutboxContext = {
  $parent: {
    $queryRaw: <T>(
      query: TemplateStringsArray,
      ...values: unknown[]
    ) => Promise<T>;
  };
  count: (args: object) => Promise<number>;
  updateMany: (args: object) => Promise<{ count: number }>;
  upsert: (args: {
    create: EnqueueOutboxMessage;
    update: object;
    where: { deduplicationKey: string };
  }) => Promise<unknown>;
};

/**
 * Resolves the calling delegate, including its interactive transaction parent.
 * @param delegate Calling model extension context.
 * @returns Outbox model operations on the current client, never a captured root.
 */
export const getOutboxContext = (delegate: unknown): OutboxContext => {
  const context = Prisma.getExtensionContext(delegate);

  assert.defined(context, "Outbox extension requires a model context.");
  assert.true(
    "upsert" in context && "updateMany" in context && "count" in context,
    "Outbox extension requires the canonical OutboxMessage model.",
  );
  assert.defined(context.$parent, "Outbox extension requires a client parent.");
  assert.true(
    typeof context.$parent === "object" && "$queryRaw" in context.$parent,
    "Outbox extension requires a Prisma 7 client context.",
  );

  // Canonical schema supplies the delegate signatures; no generated client import.
  return context as OutboxContext;
};
