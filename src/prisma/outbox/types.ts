import type { InputJsonValue, JsonValue } from "@prisma/client/runtime/client";

export type EnqueueOutboxMessage = Readonly<{
  aggregateId: string;
  aggregateType: string;
  availableAt?: Date;
  deduplicationKey: string;
  payload: InputJsonValue;
  topic: string;
}>;

export type OutboxClaim = Readonly<{
  aggregateId: string;
  aggregateType: string;
  claimToken: string;
  deduplicationKey: string;
  id: string;
  payload: JsonValue;
  topic: string;
}>;

export type ClaimOutboxMessages = Readonly<{
  leaseSeconds: number;
  limit: number;
  topic: string;
}>;

export type CompleteOutboxMessage = Readonly<{
  claimToken: string;
  deduplicationKey: string;
  id: string;
  reason: string;
}>;

export type FailOutboxMessage = Readonly<{
  claimToken: string;
  error: string;
  id: string;
  retryAt: Date;
}>;

export type OutboxCompletion = Readonly<{
  changed: boolean;
  completed: boolean;
}>;
