// eslint-disable-next-line @typescript-eslint/no-require-imports -- Verify the CommonJS declaration branch intentionally.
import utils = require("@db21/toolkit/utils");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Verify the CommonJS declaration branch intentionally.
import money = require("@db21/toolkit/money");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Verify the CommonJS declaration branch intentionally.
import events = require("@db21/toolkit/events");
import { z } from "zod";

const ping = events.defineEvent("ping", "system.ping", 1, z.object({}));

export const eventRegistry: events.EventRegistry<readonly [typeof ping]> =
  events.createRegistry([ping]);
export const event: events.DomainEvent = eventRegistry.createEvent(
  "system.ping",
  {
    eventId: "4423fb0f-848d-4e34-a71f-01b609b1e7cf",
    occurredAt: "2026-08-21T12:00:00.000Z",
  },
);

export const empty: boolean = utils.isEmpty([]);
export const amount: money.Money | undefined = money.createMoney(
  "12.34",
  "USD",
);
