import { claim } from "./claim.js";
import { getOutboxContext } from "./context.js";
import type {
  CompleteOutboxMessage,
  EnqueueOutboxMessage,
  FailOutboxMessage,
  OutboxCompletion,
} from "./types.js";

export type {
  ClaimOutboxMessages,
  CompleteOutboxMessage,
  EnqueueOutboxMessage,
  FailOutboxMessage,
  OutboxClaim,
  OutboxCompletion,
} from "./types.js";

async function enqueue(
  this: unknown,
  message: EnqueueOutboxMessage,
): Promise<void> {
  const context = getOutboxContext(this);

  await context.upsert({
    create: message,
    update: {},
    where: { deduplicationKey: message.deduplicationKey },
  });
}

async function complete(
  this: unknown,
  { id, claimToken, deduplicationKey, reason }: CompleteOutboxMessage,
): Promise<OutboxCompletion> {
  const context = getOutboxContext(this);
  const result = await context.updateMany({
    data: {
      claimExpiresAt: null,
      claimToken: null,
      completedAt: new Date(),
      completionReason: reason,
      lastError: null,
    },
    where: { claimToken, completedAt: null, deduplicationKey, id },
  });

  if (result.count === 1) {
    return { changed: true, completed: true };
  }

  const completed = await context.count({
    where: {
      completedAt: { not: null },
      completionReason: reason,
      deduplicationKey,
      id,
    },
  });

  return { changed: false, completed: completed === 1 };
}

async function markFailed(
  this: unknown,
  { id, claimToken, error, retryAt }: FailOutboxMessage,
): Promise<boolean> {
  const context = getOutboxContext(this);
  const result = await context.updateMany({
    data: {
      availableAt: retryAt,
      claimExpiresAt: null,
      claimToken: null,
      lastError: error,
    },
    where: { claimToken, completedAt: null, id },
  });

  return result.count === 1;
}

/**
 * Adds PostgreSQL outbox persistence to the canonical OutboxMessage delegate.
 * @returns Model extension; enqueue inside the owning domain transaction.
 */
export const outboxExtension = (): {
  name: string;
  model: {
    outboxMessage: {
      enqueue: typeof enqueue;
      claim: typeof claim;
      complete: typeof complete;
      markFailed: typeof markFailed;
    };
  };
} => ({
  name: "db21-outbox",
  model: { outboxMessage: { enqueue, claim, complete, markFailed } },
});
