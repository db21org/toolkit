# Domain events

Import generic versioned-event helpers from `@db21/toolkit/events` (ESM or
CommonJS). Install the optional peer `zod@^4.4.3` when using this entry point.
Other toolkit entry points do not require Zod.

```ts
import { createRegistry, defineEvent } from "@db21/toolkit/events";
import { z } from "zod";

const itemCreated = defineEvent(
  "itemCreated",
  "item.created",
  1,
  z.object({ itemId: z.string().min(1) }),
);
const { createEvent, eventTypes, safeParseEvent } = createRegistry([
  itemCreated,
]);

const event = createEvent(eventTypes.itemCreated, {
  eventId: crypto.randomUUID(),
  occurredAt: new Date().toISOString(),
  itemId: "item-1",
});
const result = safeParseEvent(eventTypes.itemCreated, event);
```

## Contract

- `domainEventSchema` validates the common `DomainEvent` envelope: UUID `eventId`,
  ISO datetime `occurredAt`, nonempty string `type`, and positive integer `version`.
- `defineEvent(name, type, version, payloadSchema)` returns a frozen
  `EventDefinition` containing the payload and complete strict event schemas.
  Payloads use Zod object schemas; object refinements are retained and payload
  transforms run once per parse. Only payload fields reach the payload schema,
  so strict payload objects are supported. Reserve envelope field names for metadata.
- `createRegistry(definitions)` returns a frozen typed `EventRegistry` and frozen
  `eventTypes` mapping. It snapshots the definitions array. Names must be unique,
  including prototype-sensitive names such as `__proto__`. Use one definition per routing key;
  lookup selects the first matching type, not a type/version pair.
- `createEvent(type, input)` validates caller-supplied IDs/timestamps and payload,
  supplying the registered type/version. It does not generate metadata or publish.
  Invalid data throws a Zod error; unknown routing keys throw an error.
- `safeParseEvent(type, input)` validates an unknown complete event against the
  selected definition, including exact type/version and rejection of extra fields.
  Invalid data returns a Zod safe-parse result; unknown routing keys still throw.

These helpers were extracted from Amatok without its product-specific event
definitions or registry. Transport, persistence, retries, and consumer dispatch
remain application concerns.
