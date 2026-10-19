// eslint-disable-next-line @typescript-eslint/no-require-imports -- Verify the CommonJS declaration branch intentionally.
import utils = require("@db21/toolkit/utils");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Verify the CommonJS declaration branch intentionally.
import money = require("@db21/toolkit/money");

export const empty: boolean = utils.isEmpty([]);
export const amount: money.Money | undefined = money.createMoney(
  "12.34",
  "USD",
);
