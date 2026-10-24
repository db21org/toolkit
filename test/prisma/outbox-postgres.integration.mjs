import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import { createPostgresFixture } from "./postgres-fixture.mjs";

let prisma;
let heldTransaction;
let fixture;

before(async () => {
  fixture = await createPostgresFixture();
  prisma = fixture.prisma;
});

after(async () => {
  await fixture?.dispose();
});

const message = (topic, key = randomUUID()) => ({
  topic,
  aggregateType: "Order",
  aggregateId: key,
  deduplicationKey: key,
  payload: { eventId: key },
});

const claim = (topic, limit = 10) =>
  prisma.$transaction((tx) =>
    tx.outboxMessage.claim({ topic, limit, leaseSeconds: 60 }),
  );

// eslint-disable-next-line db21-tests/require-justification -- Risk: root-client leakage commits messages without their domain writes; Contract: enqueue, claims, completion and retry all roll back with the calling transaction.
test("all extension operations remain on the caller transaction", async () => {
  const input = message("rollback");

  await assert.rejects(
    prisma.$transaction(async (tx) => {
      await tx.order.create({ data: { id: input.aggregateId } });
      await tx.outboxMessage.enqueue(input);

      throw new Error("rollback");
    }),
    /rollback/u,
  );
  const orders = await prisma.order.count();
  const messages = await prisma.outboxMessage.count();

  assert.equal(orders, 0);
  assert.equal(messages, 0);
  await prisma.outboxMessage.enqueue(input);
  await assert.rejects(
    prisma.$transaction(async (tx) => {
      const [leased] = await tx.outboxMessage.claim({
        topic: "rollback",
        limit: 1,
        leaseSeconds: 60,
      });

      assert.ok(leased?.claimToken);

      throw new Error("rollback claim");
    }),
    /rollback claim/u,
  );

  const row = await prisma.outboxMessage.findUniqueOrThrow({
    where: { deduplicationKey: input.deduplicationKey },
  });

  assert.equal(row.claimToken, null);
  assert.equal(row.attemptCount, 0);

  const [leased] = await claim("rollback");

  for (const operation of [
    (delegate) => delegate.complete({ ...leased, reason: "delivered" }),
    (delegate) =>
      delegate.markFailed({
        ...leased,
        error: "offline",
        retryAt: new Date("2099-01-01"),
      }),
  ]) {
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        await operation(tx.outboxMessage);

        throw new Error("rollback acknowledgement");
      }),
      /rollback acknowledgement/u,
    );
  }

  const unchanged = await prisma.outboxMessage.findUniqueOrThrow({
    where: { id: leased.id },
  });

  assert.equal(unchanged.completedAt, null);
  assert.equal(unchanged.claimToken, leased.claimToken);
  assert.equal(unchanged.lastError, null);
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: competing workers block or deliver overlapping batches; Contract: another transaction skips held row locks and later concurrent claims have disjoint identities.
test("concurrent workers skip locked rows and claim disjoint batches", async () => {
  for (let index = 0; index < 6; index += 1) {
    await prisma.outboxMessage.enqueue(message("concurrent"));
  }

  const ready = Promise.withResolvers();
  const release = Promise.withResolvers();

  heldTransaction = prisma.$transaction(
    async (tx) => {
      const batch = await tx.outboxMessage.claim({
        topic: "concurrent",
        limit: 2,
        leaseSeconds: 60,
      });

      ready.resolve(batch);
      await release.promise;

      return batch;
    },
    { timeout: 10_000 },
  );

  try {
    const first = await Promise.race([ready.promise, heldTransaction]);
    const second = await claim("concurrent", 2);

    assert.equal(first.length, 2);
    assert.equal(second.length, 2);
    assert.equal(
      new Set([...first, ...second].map((entry) => entry.id)).size,
      4,
    );
  } finally {
    release.resolve();
    await heldTransaction;
  }

  // eslint-disable-next-line db21-promises/prefer-native-batch -- Distinct workers must claim concurrently to detect overlapping delivery; combining claims into one batch removes that race.
  const batches = await Promise.all([
    claim("concurrent", 2),
    claim("concurrent", 2),
  ]);

  assert.equal(batches.flat().length, 2);
  assert.equal(new Set(batches.flat().map((entry) => entry.id)).size, 2);
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: an expired worker acknowledges or releases a newer delivery; Contract: reclaim rotates tokens and stale complete or failure operations cannot mutate the current claim.
test("reclaim fences stale workers and completion is idempotent", async () => {
  await prisma.outboxMessage.enqueue(message("fencing"));

  const [stale] = await claim("fencing");

  await prisma.outboxMessage.update({
    where: { id: stale.id },
    data: { claimExpiresAt: new Date(0) },
  });

  const [current] = await claim("fencing");

  assert.equal(current.id, stale.id);
  assert.notEqual(current.claimToken, stale.claimToken);
  const staleCompletion = await prisma.outboxMessage.complete({
    ...stale,
    reason: "delivered",
  });

  const staleFailure = await prisma.outboxMessage.markFailed({
    ...stale,
    error: "late",
    retryAt: new Date(0),
  });

  const wrongIdentity = await prisma.outboxMessage.complete({
    ...current,
    deduplicationKey: randomUUID(),
    reason: "delivered",
  });

  const completion = await prisma.outboxMessage.complete({
    ...current,
    reason: "delivered",
  });

  const repeated = await prisma.outboxMessage.complete({
    ...current,
    reason: "delivered",
  });
  const remaining = await claim("fencing");
  const otherReason = await prisma.outboxMessage.complete({
    ...current,
    reason: "discarded",
  });

  assert.deepEqual(staleCompletion, { changed: false, completed: false });
  assert.equal(staleFailure, false);
  assert.deepEqual(wrongIdentity, { changed: false, completed: false });
  assert.deepEqual(completion, { changed: true, completed: true });
  assert.deepEqual(repeated, { changed: false, completed: true });
  assert.deepEqual(remaining, []);
  assert.deepEqual(otherReason, { changed: false, completed: false });
});

// eslint-disable-next-line db21-tests/require-justification -- Risk: retries duplicate intent or ignore scheduling boundaries; Contract: deduplication preserves first payload, failed claims wait until available, and invalid claim limits never reach SQL.
test("deduplication, retries and claim bounds preserve durable intent", async () => {
  const input = message("retry");

  await prisma.outboxMessage.enqueue(input);
  await prisma.outboxMessage.enqueue({ ...input, payload: { changed: true } });
  const count = await prisma.outboxMessage.count({ where: { topic: "retry" } });

  assert.equal(count, 1);

  const [leased] = await claim("retry");

  assert.deepEqual(leased.payload, input.payload);
  const released = await prisma.outboxMessage.markFailed({
    ...leased,
    error: "offline",
    retryAt: new Date("2099-01-01"),
  });
  const scheduled = await claim("retry");

  assert.equal(released, true);
  assert.deepEqual(scheduled, []);
  await prisma.outboxMessage.update({
    where: { id: leased.id },
    data: { availableAt: new Date(0) },
  });
  const retried = await claim("retry");

  assert.equal(retried.length, 1);

  for (const overrides of [
    { topic: " " },
    { topic: "a".repeat(129) },
    { limit: 0 },
    { limit: 1001 },
    { limit: 1.5 },
    { leaseSeconds: 0 },
    { leaseSeconds: 1.5 },
    { leaseSeconds: 86401 },
  ]) {
    await assert.rejects(
      prisma.outboxMessage.claim({
        topic: "retry",
        limit: 1,
        leaseSeconds: 60,
        ...overrides,
      }),
      /Outbox claim/u,
    );
  }
});
