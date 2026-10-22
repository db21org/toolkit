import { z } from "zod";

import { type DomainEvent, domainEventSchema } from "./domain-event.js";

export type EventDefinition<
  TName extends string = string,
  TType extends string = string,
  TVersion extends number = number,
  TPayloadSchema extends z.ZodObject = z.ZodObject,
> = Readonly<{
  name: TName;
  payloadSchema: TPayloadSchema;
  schema: z.ZodType<DomainEvent & z.output<TPayloadSchema>>;
  type: TType;
  version: TVersion;
}>;

/**
 * Defines one versioned event and its complete runtime schema.
 * @param name Short code-facing event identifier.
 * @param type Stable event name and routing key.
 * @param version Event payload version.
 * @param payloadSchema Event-specific payload schema.
 * @returns Event definition consumed by the registry.
 */
export const defineEvent = <
  const TName extends string,
  const TType extends string,
  const TVersion extends number,
  TPayloadShape extends z.ZodRawShape,
>(
  name: TName,
  type: TType,
  version: TVersion,
  payloadSchema: z.ZodObject<TPayloadShape>,
): EventDefinition<TName, TType, TVersion, z.ZodObject<TPayloadShape>> => {
  type Event = DomainEvent & z.output<typeof payloadSchema>;
  const payloadFields = Object.fromEntries(
    Object.keys(payloadSchema.shape).map((key) => [
      key,
      z.unknown().optional(),
    ]),
  );

  const inputSchema = z.strictObject({
    ...payloadFields,
    eventId: domainEventSchema.shape.eventId,
    occurredAt: domainEventSchema.shape.occurredAt,
    type: z.literal(type),
    version: z.literal(version),
  });

  const schema = inputSchema.transform((input, context): Event => {
    const {
      eventId,
      occurredAt,
      type: eventType,
      version: eventVersion,
      ...payloadInput
    } = input;
    const result = payloadSchema.safeParse(payloadInput);

    if (!result.success) {
      for (const issue of result.error.issues) {
        context.addIssue({ ...issue });
      }

      return z.NEVER;
    }

    return {
      ...result.data,
      eventId,
      occurredAt,
      type: eventType,
      version: eventVersion,
    };
  });

  return Object.freeze({ name, payloadSchema, schema, type, version });
};
