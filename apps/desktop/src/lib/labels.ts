import type { TranslationKey } from "@/i18n";

/**
 * Enum value → translation key. Render with `t(accountTypeLabels[type])`;
 * the text itself lives in `locales/<lang>/labels.json`.
 */
export const accountTypeLabels = {
  CHECKING: "labels.accountType.CHECKING",
  SAVINGS: "labels.accountType.SAVINGS",
  CASH: "labels.accountType.CASH",
  BROKERAGE: "labels.accountType.BROKERAGE",
  CRYPTO: "labels.accountType.CRYPTO",
  OTHER: "labels.accountType.OTHER",
} as const satisfies Record<string, TranslationKey>;

export const entryTypeLabels = {
  INCOME: "labels.entryType.INCOME",
  EXPENSE: "labels.entryType.EXPENSE",
  TRANSFER: "labels.entryType.TRANSFER",
} as const satisfies Record<string, TranslationKey>;

export const assetClassLabels = {
  FIXED_INCOME: "labels.assetClass.FIXED_INCOME",
  STOCK: "labels.assetClass.STOCK",
  FII: "labels.assetClass.FII",
  ETF: "labels.assetClass.ETF",
  CRYPTO: "labels.assetClass.CRYPTO",
  OTHER: "labels.assetClass.OTHER",
} as const satisfies Record<string, TranslationKey>;

export const invoiceStatusLabels = {
  EMPTY: "labels.invoiceStatus.EMPTY",
  OPEN: "labels.invoiceStatus.OPEN",
  CLOSED: "labels.invoiceStatus.CLOSED",
  PAID: "labels.invoiceStatus.PAID",
  OVERDUE: "labels.invoiceStatus.OVERDUE",
} as const satisfies Record<string, TranslationKey>;
