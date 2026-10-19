import { isDefined, isEmpty, isNotDefined } from "../utils/predicates.js";
import { Decimal, type Decimal as DecimalValue } from "./decimal.js";

export type Money = Readonly<{
  amount: DecimalValue;
  currency: string;
}>;

export type SerializedMoney = Readonly<{
  amount: string;
  currency: string;
}>;

export type ExchangeRateSnapshot = Readonly<{
  baseCurrency: string;
  rateDate: string;
  rates: Readonly<Record<string, string>>;
  source: string;
}>;

const currencyPattern = /^[A-Z]{3}$/u;
const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const rateDatePattern = /^\d{4}-\d{2}-\d{2}$/u;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && isDefined(value) && !Array.isArray(value);

/**
 * Normalizes an ISO-style currency code.
 * @param currency Candidate currency code.
 * @returns Normalized code when valid.
 */
export const normalizeCurrency = (currency: string): string | undefined => {
  const normalized = currency.trim().toUpperCase();

  return currencyPattern.test(normalized) ? normalized : undefined;
};

/**
 * Normalizes one non-negative decimal amount without converting it to binary floating point.
 * @param amount Candidate decimal amount.
 * @returns Trimmed decimal amount when valid.
 */
export const normalizeMoneyAmount = (amount: string): string | undefined => {
  const normalized = amount.trim();

  return decimalPattern.test(normalized) ? normalized : undefined;
};

/**
 * Creates a Money value when both the decimal amount and currency are valid.
 * @param amount Candidate decimal amount.
 * @param currency Candidate currency code.
 * @returns Money when both values are valid.
 */
export const createMoney = (
  amount: string,
  currency: string,
): Money | undefined => {
  const normalizedAmount = normalizeMoneyAmount(amount);
  const normalizedCurrency = normalizeCurrency(currency);

  return isNotDefined(normalizedAmount) || isNotDefined(normalizedCurrency)
    ? undefined
    : { amount: new Decimal(normalizedAmount), currency: normalizedCurrency };
};

/**
 * Hydrates serialized Money into its Decimal-backed domain representation.
 * @param money Serialized transport Money.
 * @returns Decimal-backed Money when valid.
 */
export const deserializeMoney = (money: SerializedMoney): Money | undefined =>
  createMoney(money.amount, money.currency);

/**
 * Validates one exchange-rate snapshot received across a transport boundary.
 * @param value Candidate serialized snapshot.
 * @returns Validated snapshot when all rates are positive decimal strings.
 */
export const deserializeExchangeRateSnapshot = (
  value: unknown,
): ExchangeRateSnapshot | undefined => {
  if (
    !isRecord(value) ||
    !isRecord(value.rates) ||
    typeof value.baseCurrency !== "string" ||
    typeof value.rateDate !== "string" ||
    typeof value.source !== "string"
  ) {
    return undefined;
  }

  const baseCurrency = normalizeCurrency(value.baseCurrency);
  const rates = Object.fromEntries(
    Object.entries(value.rates).flatMap(([currency, rate]) => {
      const normalizedCurrency = normalizeCurrency(currency);
      const normalizedRate =
        typeof rate === "string" ? normalizeMoneyAmount(rate) : undefined;

      // Exchange rates must be strictly positive; accepting zero would make
      // source-to-base conversion undefined even though zero is not negative.
      return isNotDefined(normalizedCurrency) ||
        isNotDefined(normalizedRate) ||
        !new Decimal(normalizedRate).greaterThan(0)
        ? []
        : [[normalizedCurrency, normalizedRate]];
    }),
  );

  if (
    isNotDefined(baseCurrency) ||
    !rateDatePattern.test(value.rateDate) ||
    isEmpty(value.source.trim()) ||
    Object.keys(rates).length !== Object.keys(value.rates).length ||
    isNotDefined(rates[baseCurrency])
  ) {
    return undefined;
  }

  return {
    baseCurrency,
    rateDate: value.rateDate,
    rates,
    source: value.source.trim(),
  };
};

/**
 * Serializes Decimal-backed Money for transport or persistence boundaries.
 * @param money Decimal-backed Money.
 * @returns Exact decimal text paired with its currency.
 */
export const serializeMoney = (money: Money): SerializedMoney => ({
  amount: money.amount.toString(),
  currency: money.currency,
});

/**
 * Converts Money using one coherent rate snapshot and decimal arithmetic.
 * @param money Source Money.
 * @param targetCurrency Desired three-letter currency code.
 * @param snapshot Rates sharing the declared snapshot base.
 * @param decimalPlaces Maximum fractional digits in the converted amount.
 * @returns Converted Money, or unchanged source Money when conversion is unavailable.
 */
export const convertMoney = (
  money: Money,
  targetCurrency: string,
  snapshot: ExchangeRateSnapshot,
  decimalPlaces = 6,
): Money => {
  const normalizedTarget = normalizeCurrency(targetCurrency);

  if (isNotDefined(normalizedTarget) || normalizedTarget === money.currency) {
    return money;
  }

  const sourceRate = snapshot.rates[money.currency];
  const targetRate = snapshot.rates[normalizedTarget];

  if (isNotDefined(sourceRate) || isNotDefined(targetRate)) {
    return money;
  }

  const amount = money.amount
    .dividedBy(sourceRate)
    .times(targetRate)
    .toDecimalPlaces(decimalPlaces)
    .toString();

  return createMoney(amount, normalizedTarget) ?? money;
};

/**
 * Formats Money for presentation in a requested locale.
 * @param money Money to format.
 * @param locales Intl locale preference.
 * @returns Localized currency text.
 */
export const formatMoney = (
  money: Money,
  locales?: Intl.LocalesArgument,
): string =>
  new Intl.NumberFormat(locales, {
    currency: money.currency,
    style: "currency",
  }).format(money.amount.toString() as Intl.StringNumericLiteral);
