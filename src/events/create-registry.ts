import type { z } from "zod";

import { assert } from "../utils/index.js";
import type { EventDefinition } from "./define-event.js";
import type { DomainEvent } from "./domain-event.js";

type EventDefinitionFor<
  TDefinitions extends readonly EventDefinition[],
  TType extends TDefinitions[number]["type"],
> = Extract<TDefinitions[number], { type: TType }>;

type EventInput<
  TDefinitions extends readonly EventDefinition[],
  TType extends TDefinitions[number]["type"],
> = Pick<DomainEvent, "eventId" | "occurredAt"> &
  (keyof EventDefinitionFor<
    TDefinitions,
    TType
  >["payloadSchema"]["shape"] extends never
    ? unknown
    : z.input<EventDefinitionFor<TDefinitions, TType>["payloadSchema"]>);

type EventOutput<
  TDefinitions extends readonly EventDefinition[],
  TType extends TDefinitions[number]["type"],
> = z.output<EventDefinitionFor<TDefinitions, TType>["schema"]>;

type EventTypes<TDefinitions extends readonly EventDefinition[]> = Readonly<{
  [
    TDefinition in TDefinitions[number] as TDefinition["name"]
  ]: TDefinition["type"];
}>;

export type EventRegistry<TDefinitions extends readonly EventDefinition[]> =
  Readonly<{
    createEvent: <TType extends TDefinitions[number]["type"]>(
      type: TType,
      input: EventInput<TDefinitions, TType>,
    ) => EventOutput<TDefinitions, TType>;
    eventTypes: EventTypes<TDefinitions>;
    safeParseEvent: <TType extends TDefinitions[number]["type"]>(
      type: TType,
      input: unknown,
    ) => z.ZodSafeParseResult<EventOutput<TDefinitions, TType>>;
  }>;

const createEventTypes = <TDefinitions extends readonly EventDefinition[]>(
  definitions: TDefinitions,
): EventTypes<TDefinitions> => {
  const eventTypes: Record<string, string> = {};

  for (const definition of definitions) {
    assert.false(
      Object.hasOwn(eventTypes, definition.name),
      `Duplicate event name: ${definition.name}`,
    );
    Object.defineProperty(eventTypes, definition.name, {
      value: definition.type,
      enumerable: true,
    });
  }

  return Object.freeze(eventTypes) as EventTypes<TDefinitions>;
};

const findEventDefinition = (
  definitions: readonly EventDefinition[],
  type: string,
): EventDefinition => {
  const definition = definitions.find((candidate) => candidate.type === type);

  assert.defined(definition, `Unknown event type: ${type}`);

  return definition;
};

/**
 * Creates a typed event registry from domain-owned definitions.
 * @param definitions Supported event definitions.
 * @returns Registry exposing validated event creation and parsing.
 */
export const createRegistry = <
  const TDefinitions extends readonly EventDefinition[],
>(
  definitions: TDefinitions,
): EventRegistry<TDefinitions> => {
  const registeredDefinitions = Object.freeze([...definitions]);

  return Object.freeze({
    createEvent<TType extends TDefinitions[number]["type"]>(
      type: TType,
      input: EventInput<TDefinitions, TType>,
    ): EventOutput<TDefinitions, TType> {
      const definition = findEventDefinition(
        registeredDefinitions,
        type,
      ) as EventDefinitionFor<TDefinitions, TType>;

      return definition.schema.parse({
        ...input,
        type: definition.type,
        version: definition.version,
      }) as EventOutput<TDefinitions, TType>;
    },
    eventTypes: createEventTypes(registeredDefinitions),
    safeParseEvent<TType extends TDefinitions[number]["type"]>(
      type: TType,
      input: unknown,
    ): z.ZodSafeParseResult<EventOutput<TDefinitions, TType>> {
      const definition = findEventDefinition(
        registeredDefinitions,
        type,
      ) as EventDefinitionFor<TDefinitions, TType>;

      return definition.schema.safeParse(input) as z.ZodSafeParseResult<
        EventOutput<TDefinitions, TType>
      >;
    },
  });
};
