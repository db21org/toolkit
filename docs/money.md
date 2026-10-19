# Money

Import money helpers from `@db21/toolkit/money`. They provide decimal-backed values,
serialization, exchange-rate conversion, and locale-aware display. These helpers
implement specific policies; they are not a complete accounting library.

## Amounts and currencies

`createMoney(amount, currency)` accepts **nonnegative decimal strings** and returns
`undefined` for invalid input. Negative balances, refunds expressed as negative
amounts, signed adjustments, exponent notation, and localized numeric strings are
not supported by the creation/normalization helpers.

Currency codes are trimmed and uppercased, then checked for three ASCII letters.
This is a shape check, not validation against an ISO 4217 registry. Types are
structural: manually constructing a `Money` object bypasses these checks.

## Precision and rounding

The exported `Decimal` constructor is cloned from decimal.js with **40 significant
digits** of arithmetic precision and `ROUND_HALF_UP` rounding. Constructors retain
their input precision; the configured precision applies to arithmetic operations.
These are shared defaults, not configurable per money-helper invocation. Avoid
mutating the exported constructor's settings in shared applications.

`convertMoney` additionally rounds its result to **six fractional digits** by
default. Its fourth argument changes that fractional-digit limit. It does not
automatically round to a currency's standard minor units.

## Conversion fallback

`convertMoney(money, targetCurrency, snapshot, decimalPlaces?)` returns the
**original money object** when the target code is invalid, the source and target
are equal, required rates are missing, or the converted result cannot be created.
Missing conversion data does not produce an explicit error result.

Always inspect the returned currency before treating a conversion as successful.
Callers needing explicit failure reporting should validate rates and target codes
at their boundary instead of assuming that a returned value uses the target
currency.

The fallback is not an exception boundary. Invalid runtime rate strings or
out-of-range `decimalPlaces` can still throw from decimal.js. Validate untrusted
snapshots with `deserializeExchangeRateSnapshot` before conversion and pass a
valid fractional-digit limit.

Exchange-rate snapshots use rates relative to one base currency and require a
positive rate for each entry, including the base. The date is checked for
`YYYY-MM-DD` shape only, not calendar validity. Source labels must be nonempty;
freshness, provider trust, and a base rate equal to one are not verified.

## Display

`formatMoney` uses `Intl.NumberFormat` with the requested locale, or the host's
default locale when omitted. Display rounding follows `Intl` currency defaults;
it does not change the underlying amount. Use serialized decimal strings for
transport or persistence rather than formatted display text.
