# Prisma PostgreSQL outbox

`@db21/toolkit/prisma/outbox` adds transactional enqueue, atomic batch claims,
token-fenced completion and scheduled retries to Prisma 7.8 or later, below 8.
PostgreSQL is required. The toolkit schema is the single source for the
`OutboxMessage` model and `outbox_messages` table.

## Schema composition

Install and pin toolkit and your Prisma packages. Configure the database package:

```ts
import { withOutboxSchema } from "@db21/toolkit/prisma/outbox/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: withOutboxSchema({
    baseDirectory: import.meta.dirname,
    source: "prisma/schema",
    output: ".generated/schema",
  }),
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
```

Keep product models, generators and the PostgreSQL datasource in `prisma/schema`.
Ignore `.generated/` in Git. Use your normal commands:

```sh
prisma generate
prisma migrate dev --name add-outbox
prisma migrate deploy
```

The configuration helper reads `.prisma` files recursively, adds the bundled
outbox model and returns an absolute, immutable, content-addressed snapshot path.
It never connects to a database or runs migrations. Identical inputs reuse the
same files; changed or removed models create a fresh snapshot. Publication uses
atomic directory renames, so concurrent commands see complete snapshots. Older
snapshots remain; remove the dedicated generated directory only when no Prisma
commands are using it. Never edit or format snapshots: edit/format the product
schema source instead. Modified snapshots are refused, not overwritten.

Both paths must be disjoint directories inside `baseDirectory`, with no symlinks.
Output must be absent or owned by this helper, not an existing user directory.
The source must not define `OutboxMessage` or use the reserved root filename
`toolkit-outbox.prisma`. Static generator `output` strings are relocated to
absolute paths relative to their original schema file; dynamic outputs such as
`env("OUTPUT")` are refused. The standard `prisma-client-js` generator's default
output remains in the package's `node_modules`; explicit generator outputs work
for `prisma-client` and other generators as well. Other generator-specific relative
file settings are not rewritten: use absolute paths for those settings and for
local generator provider paths.

Client generation and migration commands must use this same configuration and
the same pinned toolkit version. On toolkit upgrades, generate and review schema
changes locally and commit the resulting migrations. Deployment runs committed
migrations with `prisma migrate deploy`; toolkit never auto-migrates at startup.
Do not introduce a second migration owner for the outbox table.

For an existing outbox, remove its local model only after comparing it with the
toolkit schema. Preserve data and review the generated diff. Novyn's model, for
example, needs the additional nullable `completionReason` field. This helper does
not perform consumer migration or remove local models automatically. Payload is
neutral Prisma JSON; product-specific JSON annotations and event validation are
not embedded in the shared model.

## Enqueue with domain writes

```ts
import { outboxExtension } from "@db21/toolkit/prisma/outbox";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ adapter }).$extends(outboxExtension());

await prisma.$transaction(async (tx) => {
  await tx.order.create({ data: order });
  await tx.outboxMessage.enqueue({
    topic: "order.created",
    aggregateType: "Order",
    aggregateId: order.id,
    deduplicationKey: event.eventId,
    payload: event,
  });
});
```

Use your generated client's import path instead when the generator has a custom
output. The extension does not construct a client or create another pool.

`enqueue` returns `void` and uses an upsert with an empty update. Repeating a
deduplication key preserves the first message, including its payload and topic;
do not reuse a key for different intent. `availableAt?: Date` schedules initial
delivery. Other metadata is required. Payload accepts Prisma input JSON, excluding
an ambiguous top-level `null`; nested JSON nulls are valid.

All methods resolve the calling model/client context, never a captured root
client. They participate in interactive `$transaction` callbacks. They are async
methods, not lazy Prisma promises: do not use them in array-form `$transaction`.
Root-client calls are supported, but an enqueue outside the domain transaction
cannot make domain writes atomic with the message.

## Claim, deliver, acknowledge

```ts
const messages = await prisma.$transaction((tx) =>
  tx.outboxMessage.claim({
    topic: "order.created",
    limit: 50,
    leaseSeconds: 60,
  }),
);

for (const message of messages) {
  try {
    await deliver(message.payload); // No database transaction held here.
  } catch (error) {
    await prisma.outboxMessage.markFailed({
      id: message.id,
      claimToken: message.claimToken,
      error: boundedErrorMessage(error),
      retryAt: chooseRetryTime(),
    });
    continue;
  }

  await prisma.outboxMessage.complete({
    id: message.id,
    claimToken: message.claimToken,
    deduplicationKey: message.deduplicationKey,
    reason: "delivered",
  });
}
```

`claim` accepts a nonblank topic of at most 128 characters, an integer limit from
1 to 1000 and an integer lease duration from 1 to 86400 seconds. It uses one
materialized PostgreSQL `clock_timestamp()`, skips locked rows, increments attempts
and assigns fresh UUID tokens in a single `UPDATE ... RETURNING`. Candidates are
selected by `availableAt`, then `id`; the returned array has no ordering guarantee.
Only available, incomplete messages without a live lease qualify. Commit the
claim transaction before external delivery. Do not acknowledge an uncommitted
claim from another transaction.

`complete({ id, claimToken, deduplicationKey, reason })` returns
`{ changed: boolean, completed: boolean }`. A current token completes the message;
repeating an already completed identity and reason returns
`{ changed: false, completed: true }`. Another completion reason returns false.
`markFailed({ id, claimToken, error, retryAt })` returns whether it released the
current claim. It clears the lease and stores the next availability time and
caller-bounded error. Completion clears the last error. Tokens fence workers
after a reclaim: expiry makes a message eligible for reclaim, but does not alone
invalidate its unchanged token. Neither method automatically retries delivery.

**Delivery is at least once. A crash after external delivery but before completion
can cause redelivery. Consumers must be idempotent. Choose leases long enough for
delivery, and handle false acknowledgement results; lease renewal is not provided.**

Validation of product events, topic routing, retry/backoff, dead-letter policy,
retention, polling, NestJS and broker integration remain application concerns.
Do not mutate the physical model/table mapping or add tenant schema mappings:
the claim SQL targets the canonical table through the connection's search path.
Use a stable PostgreSQL search path for all client operations.

## Validation

`yarn test:outbox` builds and runs real PostgreSQL integration tests in a new
disposable `postgres:17-alpine` Docker container with a random password and a
loopback-only random port. It never reads application database URLs. It generates
a client and migration SQL with non-interactive
`prisma migrate diff --from-empty`, then applies that migration with
`prisma migrate deploy`. It checks ESM/CommonJS consumer types and verifies
rollback, skip-locked concurrency, fencing, retries and deduplication.
The container and temporary files are removed afterward. Docker is required;
missing Docker is a failure, not a silently skipped database contract.
