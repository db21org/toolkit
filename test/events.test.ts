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
  it("validates shared metadata", () => {
    const event = domainEventSchema.parse({
      ...metadata,
      type: "item.created",
      version: 1,
    });

    expectTypeOf(event).toEqualTypeOf<DomainEvent>();
    expect(event.eventId).toBe(metadata.eventId);
  });

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
  it("retains literal identifiers and freezes definitions", () => {
    expectTypeOf(created.name).toEqualTypeOf<"itemCreated">();
    expectTypeOf(created.type).toEqualTypeOf<"item.created">();
    expectTypeOf(created.version).toEqualTypeOf<1>();
    expect(Object.isFrozen(created)).toBe(true);
  });

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

  it("preserves payload object refinements", () => {
    const range = defineEvent(
      "range",
      "range.created",
      1,
      z
        .object({ minimum: z.number(), maximum: z.number() })
        .refine((value) => value.maximum >= value.minimum, {
          message: "Maximum must not precede minimum",
          path: ["maximum"],
        }),
    );

    const result = range.schema.safeParse({
      ...metadata,
      type: range.type,
      version: range.version,
      minimum: 5,
      maximum: 2,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message: "Maximum must not precede minimum",
          path: ["maximum"],
        }),
      );
    }
  });
});

describe("event payload transforms", () => {
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

  it("creates typed events with registered type and version", () => {
    const event = registry.createEvent(registry.eventTypes.itemCreated, {
      ...metadata,
      itemId: "item-1",
    });

    expectTypeOf(event.itemId).toEqualTypeOf<string>();
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
  });

  it("supports empty payloads", () => {
    expect(registry.createEvent("system.ping", metadata)).toEqual({
      ...metadata,
      type: "system.ping",
      version: 2,
    });
  });
});

describe("event registry validation", () => {
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

  it("supports empty registries", () => {
    expect(createRegistry([]).eventTypes).toEqual({});
  });
});
