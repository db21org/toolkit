import { Decimal as DecimalLibrary } from "decimal.js";

/** Shared decimal arithmetic configured for precise cross-package money calculations. */
const DecimalConstructor = DecimalLibrary.clone({
  precision: 40,
  rounding: DecimalLibrary.ROUND_HALF_UP,
});

export type Decimal = InstanceType<typeof DecimalConstructor>;
export const Decimal = DecimalConstructor;
