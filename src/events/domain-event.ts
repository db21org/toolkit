import { z } from "zod";

/** Runtime schema for metadata shared by every cross-process domain event. */
export const domainEventSchema = z.object({
  eventId: z.uuid(),
  occurredAt: z.iso.datetime(),
  type: z.string().min(1),
  version: z.int().positive(),
});

export type DomainEvent = z.infer<typeof domainEventSchema>;
