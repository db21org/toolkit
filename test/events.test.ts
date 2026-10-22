import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";

import {
  createRegistry,
  defineEvent,
  type DomainEvent,
  domainEventSchema,
} from "../src/events/index.js";

const metadata = {
  eventId: "4423fb0f-848d-4e34-a71f-01b609b1e7cf",
  occurredAt: "2026-08-21T12:00:00.000Z",
};

const created = defineEvent(
  "itemCreated",
  "item.created",
  1,
  z.object({ itemId: z.string().min(1) }),
);
const ping = defineEvent("ping", "system.ping", 2, z.object({}));
const registry = createRegistry([created, ping]);

describe("domain event envelope", () => {
  // eslint-disable-next-line db21-tests/require-justification -- Shared envelope output must preserve caller metadata and its public DomainEvent type across schema changes.
  it("validates shared metadata", () => {
    const event = domainEventSchema.parse({
      ...metadata,
      type: "item.created",
      version: 1,
    });

    expectTypeOf(event).toEqualTypeOf<DomainEvent>();
    expect(event.eventId).toBe(metadata.eventId);
  });

  // eslint-disable-next-line db21-tests/require-justification -- Untrusted event metadata must satisfy identity, timestamp, routing, and positive integral version constraints.
  it.each([
    { eventId: "invalid" },
    { occurredAt: "yesterday" },
    { type: "" },
    { version: 0 },
    { version: 1.5 },
  ])("rejects invalid metadata: %o", (override) => {
    const result = domainEventSchema.safeParse({
      ...metadata,
      type: "item.created",
      version: 1,
      ...override,
    });

    expect(result.success).toBe(false);
  });
});

describe("event definitions", () => {
  // eslint-disable-next-line db21-tests/require-justification -- Event schemas must reject routing/version mismatches, invalid payloads, and unexpected envelope fields.
  it.each([{ type: "other" }, { version: 2 }, { extra: true }, { itemId: "" }])(
    "rejects mismatched or invalid event: %o",
    (override) => {
      expect(
        created.schema.safeParse({
          ...metadata,
          itemId: "item-1",
          type: created.type,
          version: created.version,
          ...override,
        }).success,
      ).toBe(false);
    },
  );
});

describe("event payload transforms", () => {
  // eslint-disable-next-line db21-tests/require-justification -- Regression: repeated parsing rejected type-changing transforms and lost payload refinement diagnostics.
  it("parses type-changing transforms once and preserves object refinements", () => {
    let transforms = 0;
    const counted = defineEvent(
      "counted",
      "item.counted",
      1,
      z
        .object({
          count: z.string().transform((value) => {
            transforms += 1;

            return Number(value);
          }),
        })
        .refine((value) => value.count > 0, {
          path: ["count"],
          message: "Must be positive",
        }),
    );
    const countedRegistry = createRegistry([counted]);
    const event = countedRegistry.createEvent("item.counted", {
      ...metadata,
      count: "2",
    });

    expectTypeOf(event.count).toEqualTypeOf<number>();
    expect(event.count).toBe(2);
    expect(transforms).toBe(1);
    const invalid = countedRegistry.safeParseEvent("item.counted", {
      ...metadata,
      type: counted.type,
      version: 1,
      count: "0",
    });

    expect(invalid.success).toBe(false);
    expect(transforms).toBe(2);

    if (!invalid.success) {
      expect(invalid.error.issues).toContainEqual(
        expect.objectContaining({
          path: ["count"],
          message: "Must be positive",
        }),
      );
    }
  });
});

describe("same-type payload transforms", () => {
  // eslint-disable-next-line db21-tests/require-justification -- Envelope metadata must be separated before strict payload validation so defaults and optional fields remain usable.
  it("supports strict payloads with defaults and optional fields", () => {
    const strict = defineEvent(
      "strict",
      "strict.created",
      1,
      z.strictObject({
        count: z.number().default(1),
        label: z.string().optional(),
      }),
    );

    const event = strict.schema.parse({
      ...metadata,
      type: strict.type,
      version: 1,
    });

    expect(event.count).toBe(1);
    expect(event.label).toBeUndefined();
    expect(strict.schema.safeParse({ ...event, extra: true }).success).toBe(
      false,
    );
  });

  // eslint-disable-next-line db21-tests/require-justification -- Regression: duplicate payload parsing silently applied same-type transforms more than once per event.
  it("does not apply same-type transforms repeatedly", () => {
    const incremented = defineEvent(
      "incremented",
      "item.incremented",
      1,
      z.object({ count: z.number().transform((value) => value + 1) }),
    );

    expect(
      incremented.schema.parse({
        ...metadata,
        type: incremented.type,
        version: 1,
        count: 1,
      }).count,
    ).toBe(2);
  });
});

describe("event registry creation", () => {
  // eslint-disable-next-line db21-tests/require-justification -- Regression: mutating the caller's definitions array changed routing behavior after the registry was frozen.
  it("snapshots mutable definition arrays", () => {
    const definitions = [created];
    const snapshot = createRegistry(definitions);

    definitions.pop();
    const event = snapshot.createEvent("item.created", {
      ...metadata,
      itemId: "item-1",
    });

    expect(snapshot.eventTypes.itemCreated).toBe("item.created");
    expect(snapshot.safeParseEvent("item.created", event)).toEqual({
      success: true,
      data: event,
    });
  });

  // eslint-disable-next-line db21-tests/require-justification -- Regression: prototype-sensitive event names bypassed registration and duplicate checks on plain object maps.
  it("registers prototype-sensitive names as own properties and rejects duplicates", () => {
    const prototype = defineEvent(
      "__proto__",
      "prototype.created",
      1,
      z.object({}),
    );
    const prototypeRegistry = createRegistry([prototype]);

    expect(Object.hasOwn(prototypeRegistry.eventTypes, "__proto__")).toBe(true);
    expect(prototypeRegistry.eventTypes.__proto__).toBe("prototype.created");
    expect(() => createRegistry([prototype, prototype])).toThrow(
      "Duplicate event name: __proto__",
    );
  });

  // eslint-disable-next-line db21-tests/require-justification -- Registry construction must retain literal routing and payload types while preventing metadata mutation after registration.
  it("creates typed events with registered type and version", () => {
    const event = registry.createEvent(registry.eventTypes.itemCreated, {
      ...metadata,
      itemId: "item-1",
    });

    expectTypeOf(event.itemId).toEqualTypeOf<string>();
    expectTypeOf(created.name).toEqualTypeOf<"itemCreated">();
    expectTypeOf(created.type).toEqualTypeOf<"item.created">();
    expectTypeOf(created.version).toEqualTypeOf<1>();
    expectTypeOf(
      registry.eventTypes.itemCreated,
    ).toEqualTypeOf<"item.created">();
    expect(event).toEqual({
      ...metadata,
      itemId: "item-1",
      type: created.type,
      version: 1,
    });
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.eventTypes)).toBe(true);
    expect(Object.isFrozen(created)).toBe(true);
  });

  // eslint-disable-next-line db21-tests/require-justification -- Events without payload fields must still retain complete envelope metadata when parsing an empty object schema.
  it("supports empty payloads", () => {
    expect(registry.createEvent("system.ping", metadata)).toEqual({
      ...metadata,
      type: "system.ping",
      version: 2,
    });
  });
});

describe("event registry validation", () => {
  // eslint-disable-next-line db21-tests/require-justification -- Consumer parsing must return validation failures for untrusted events while creation rejects invalid typed payloads.
  it("parses untrusted events without throwing on invalid payloads", () => {
    const event = registry.createEvent("item.created", {
      ...metadata,
      itemId: "item-1",
    });

    expect(registry.safeParseEvent("item.created", event)).toEqual({
      success: true,
      data: event,
    });
    expect(
      registry.safeParseEvent("item.created", { ...event, version: 2 }).success,
    ).toBe(false);
    expect(registry.safeParseEvent("item.created", null).success).toBe(false);
    expect(() =>
      registry.createEvent("item.created", { ...metadata, itemId: "" }),
    ).toThrow();
  });

  // eslint-disable-next-line db21-tests/require-justification -- Duplicate definition names must not silently replace one routing entry with another event type.
  it("rejects duplicate names", () => {
    const duplicate = defineEvent(
      "itemCreated",
      "item.updated",
      2,
      z.object({}),
    );

    expect(() => createRegistry([created, duplicate])).toThrow(
      "Duplicate event name: itemCreated",
    );
  });

  // eslint-disable-next-line db21-tests/require-justification -- Untyped JavaScript callers must not create or parse events under unregistered runtime routing keys.
  it("rejects unknown runtime routing keys", () => {
    // Model untyped callers at a JavaScript boundary.
    const unknownType = "unknown" as typeof created.type;

    expect(() =>
      registry.createEvent(unknownType, { ...metadata, itemId: "item-1" }),
    ).toThrow("Unknown event type: unknown");
    expect(() => registry.safeParseEvent(unknownType, {})).toThrow(
      "Unknown event type: unknown",
    );
  });
});
