/** Initial currency. Amounts are integer minor units, never floats. */
export const INITIAL_CURRENCY = "BRL" as const;

export type CurrencyCode = typeof INITIAL_CURRENCY;

export type Money = {
  amount: bigint;
  currency: CurrencyCode;
};
