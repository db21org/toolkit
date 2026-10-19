import {
  convertMoney,
  createMoney,
  Decimal,
  deserializeExchangeRateSnapshot,
  formatMoney,
  type Money,
  normalizeCurrency,
  normalizeMoneyAmount,
} from "@db21/toolkit/money";
import { assert } from "@db21/toolkit/utils";
import { expect, test } from "vitest";

const money = (amount: string, currency: string): Money => {
  const value = createMoney(amount, currency);

  assert.defined(value, "Test Money must be valid.");

  return value;
};

test("exports decimal arithmetic without binary floating-point loss", () => {
  expect(new Decimal("0.1").plus("0.2").toString()).toBe("0.3");
  expect(new Decimal("9007199254740993.000001").times("1.5").toString()).toBe(
    "13510798882111489.5000015",
  );
});

test("normalizes decimal strings without losing precision", () => {
  expect(normalizeMoneyAmount(" 12.340000 ")).toBe("12.340000");
  expect(normalizeMoneyAmount("-1")).toBeUndefined();
  expect(normalizeMoneyAmount("1e3")).toBeUndefined();
});

test("normalizes three-letter currency codes", () => {
  expect(normalizeCurrency(" usd ")).toBe("USD");
  expect(normalizeCurrency("US")).toBeUndefined();
});

test("creates and localizes Money values", () => {
  expect(formatMoney(money("1234.5", "USD"), "en-US")).toBe("$1,234.50");
  expect(formatMoney(money("90071992547409.91", "USD"), "en-US")).toBe(
    "$90,071,992,547,409.91",
  );
  expect(createMoney("1234.5", "usd")?.amount.toString()).toBe("1234.5");
  expect(createMoney("1234.5", "usd")?.currency).toBe("USD");
});

test("converts Money through a coherent decimal rate snapshot", () => {
  const snapshot = {
    baseCurrency: "EUR",
    rateDate: "2026-08-24",
    rates: { CNY: "7.2", EUR: "1", USD: "1.2" },
    source: "ECB",
  } as const;

  const converted = convertMoney(money("72", "CNY"), "USD", snapshot);
  const unchanged = convertMoney(money("72", "CNY"), "UAH", snapshot);

  expect(converted.amount.toString()).toBe("12");
  expect(converted.currency).toBe("USD");
  expect(unchanged.amount.toString()).toBe("72");
  expect(unchanged.currency).toBe("CNY");
});

test("validates serialized exchange-rate snapshots", () => {
  expect(
    deserializeExchangeRateSnapshot({
      baseCurrency: "USD",
      rateDate: "2026-08-24",
      rates: { CNY: "6.5", USD: "1" },
      source: "ECB",
    }),
  ).toEqual({
    baseCurrency: "USD",
    rateDate: "2026-08-24",
    rates: { CNY: "6.5", USD: "1" },
    source: "ECB",
  });
  expect(
    deserializeExchangeRateSnapshot({
      baseCurrency: "USD",
      rateDate: "2026-08-24",
      rates: { CNY: "0", USD: "1" },
      source: "ECB",
    }),
  ).toBeUndefined();
});
