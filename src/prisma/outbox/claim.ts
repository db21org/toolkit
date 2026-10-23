import { assert, isNotEmpty } from "@db21/toolkit/utils";

import { getOutboxContext } from "./context.js";
import type { ClaimOutboxMessages, OutboxClaim } from "./types.js";

/**
 * Atomically leases messages using one database clock and fresh fencing tokens.
 * @param options Topic, bounded batch size, and lease duration.
 * @param options.topic Integration topic to claim.
 * @param options.limit Maximum batch size, from one to one thousand.
 * @param options.leaseSeconds Lease duration, at most one day.
 * @returns Messages owned by this claim until reclaimed or acknowledged.
 */
export async function claim(
  this: unknown,
  { topic, limit, leaseSeconds }: ClaimOutboxMessages,
): Promise<readonly OutboxClaim[]> {
  assert.true(
    isNotEmpty(topic.trim()) && topic.length <= 128,
    "Outbox claim topic must contain at most 128 characters.",
  );
  assert.true(
    Number.isSafeInteger(limit) && limit > 0 && limit <= 1000,
    "Outbox claim limit must be an integer between 1 and 1000.",
  );
  assert.true(
    Number.isSafeInteger(leaseSeconds) &&
      leaseSeconds > 0 &&
      leaseSeconds <= 86_400,
    "Outbox claim lease must be an integer between 1 and 86400 seconds.",
  );

  const context = getOutboxContext(this);

  // eslint-disable-next-line db21-sql/require-justification -- Atomic UPDATE RETURNING with a materialized database clock preserves lease fencing across concurrent workers; separate ORM reads and writes cannot.
  const messages = await context.$parent.$queryRaw<readonly OutboxClaim[]>`
    WITH "claim_clock" AS MATERIALIZED (
      SELECT clock_timestamp() AS "claimed_at"
    ), "claimable" AS (
      SELECT "message"."id"
      FROM "outbox_messages" AS "message" CROSS JOIN "claim_clock"
      WHERE "message"."topic" = ${topic}
        AND "message"."completed_at" IS NULL
        AND "message"."available_at" <= "claim_clock"."claimed_at"
        AND ("message"."claim_expires_at" IS NULL
          OR "message"."claim_expires_at" < "claim_clock"."claimed_at")
      ORDER BY "message"."available_at" ASC, "message"."id" ASC
      FOR UPDATE SKIP LOCKED LIMIT ${limit}
    )
    UPDATE "outbox_messages" AS "message"
    SET "attempt_count" = "message"."attempt_count" + 1,
      "claimed_at" = "claim_clock"."claimed_at",
      "claim_expires_at" = "claim_clock"."claimed_at" + (${leaseSeconds} * INTERVAL '1 second'),
      "claim_token" = gen_random_uuid(), "updated_at" = "claim_clock"."claimed_at"
    FROM "claimable", "claim_clock"
    WHERE "message"."id" = "claimable"."id"
    RETURNING "message"."aggregate_id" AS "aggregateId",
      "message"."aggregate_type" AS "aggregateType", "message"."claim_token" AS "claimToken",
      "message"."deduplication_key" AS "deduplicationKey", "message"."id",
      "message"."payload", "message"."topic"
  `;

  return messages;
}
