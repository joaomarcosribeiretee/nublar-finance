import { INITIAL_CURRENCY } from "@nublar/types";
import { z } from "zod";
import { DEFAULT_LOCALE, localeSchema } from "./locale";
import { msg } from "./messages";

export * from "./categories";
export * from "./locale";
export {
  translateValidationMessage,
  validationMessages,
  type ValidationMessageKey,
} from "./messages";

export const currencyCodeSchema = z.literal(INITIAL_CURRENCY);

/**
 * Integer amount in the currency minor unit (centavos for BRL).
 * Decimal strings such as "1234.56" are rejected.
 */
export const moneyAmountSchema = z
  .string()
  .regex(/^-?\d+$/, msg("amountInteger"))
  .transform((value) => BigInt(value));

export const positiveMinorAmountSchema = moneyAmountSchema.refine(
  (amount) => amount > 0n,
  msg("amountPositive"),
);

export const accountTypeSchema = z.enum([
  "CHECKING",
  "SAVINGS",
  "CASH",
  "BROKERAGE",
  "CRYPTO",
  "OTHER",
]);

export const categoryKindSchema = z.enum(["INCOME", "EXPENSE"]);

export const entryTypeSchema = z.enum(["INCOME", "EXPENSE", "TRANSFER"]);

export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, msg("invalidDate"))
  .refine((value) => {
    // Date rolls 2026-02-31 over into March, so compare the round trip.
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, msg("invalidDate"));

export const calendarMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, msg("invalidMonth"));

const nameSchema = z
  .string()
  .trim()
  .min(1, msg("nameRequired"))
  .max(80, msg("nameTooLong"));

/** What the account held before tracking started. May be negative (overdraft). */
const openingBalanceSchema = moneyAmountSchema;

export const institutionSchema = z.object({
  name: nameSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, msg("invalidColor")),
});

/** Nickname is optional: without one the account reads as its type. */
const nicknameSchema = z.string().trim().max(80, msg("nameTooLong"));

const institutionIdSchema = z.string().uuid(msg("invalidInstitution")).nullable();

export const createAccountSchema = z.object({
  name: nicknameSchema.optional(),
  type: accountTypeSchema,
  institutionId: institutionIdSchema.optional(),
  openingBalance: openingBalanceSchema.optional(),
});

export const updateAccountSchema = z.object({
  name: nicknameSchema,
  institutionId: institutionIdSchema.optional(),
  openingBalance: openingBalanceSchema.optional(),
});

export const createCategorySchema = z.object({
  name: nameSchema,
  kind: categoryKindSchema,
});

export const createTransactionSchema = z
  .object({
    type: entryTypeSchema,
    accountId: z.string().uuid(msg("chooseAccount")),
    destinationAccountId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    amount: positiveMinorAmountSchema,
    description: z.string().trim().max(200, msg("descriptionTooLong")).optional(),
    date: calendarDateSchema,
  })
  .superRefine((value, context) => {
    if (value.type === "TRANSFER") {
      if (!value.destinationAccountId) {
        context.addIssue({
          code: "custom",
          message: msg("chooseDestination"),
          path: ["destinationAccountId"],
        });
      }
      if (value.destinationAccountId === value.accountId) {
        context.addIssue({
          code: "custom",
          message: msg("sameAccounts"),
          path: ["destinationAccountId"],
        });
      }
      if (value.categoryId) {
        context.addIssue({
          code: "custom",
          message: msg("transferWithCategory"),
          path: ["categoryId"],
        });
      }
      return;
    }

    if (!value.categoryId) {
      context.addIssue({
        code: "custom",
        message: msg("chooseCategory"),
        path: ["categoryId"],
      });
    }
    if (value.destinationAccountId) {
      context.addIssue({
        code: "custom",
        message: msg("destinationNotTransfer"),
        path: ["destinationAccountId"],
      });
    }
  });

const dayOfMonthSchema = z
  .number({ error: msg("dayOfMonth") })
  .int(msg("dayOfMonth"))
  .min(1, msg("dayOfMonth"))
  .max(31, msg("dayOfMonth"));

export const creditCardSchema = z.object({
  name: nameSchema,
  limit: moneyAmountSchema.refine((v) => v >= 0n, msg("limitNegative")),
  closingDay: dayOfMonthSchema,
  dueDay: dayOfMonthSchema,
  paymentAccountId: z.string().uuid().nullable().optional(),
  institutionId: institutionIdSchema.optional(),
});

export const cardPurchaseSchema = z.object({
  cardId: z.string().uuid(msg("chooseCard")),
  categoryId: z.string().uuid(msg("chooseCategory")),
  amount: positiveMinorAmountSchema,
  installments: z
    .number()
    .int()
    .min(1, msg("minOneInstallment"))
    .max(48, msg("max48Installments")),
  description: z.string().trim().max(200, msg("descriptionTooLong")).optional(),
  date: calendarDateSchema,
});

export const cardPaymentSchema = z.object({
  accountId: z.string().uuid(msg("chooseAccount")),
  amount: positiveMinorAmountSchema,
  date: calendarDateSchema,
  invoiceMonth: calendarMonthSchema,
});

export const recurringRuleSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE"]),
    accountId: z.string().uuid(msg("chooseAccount")).nullable().optional(),
    /** On a card the charge lands on every invoice; no day is needed. */
    cardId: z.string().uuid(msg("chooseCard")).nullable().optional(),
    categoryId: z.string().uuid(msg("chooseCategory")),
    /** Per month, or the total when `installments` is set. */
    amount: positiveMinorAmountSchema,
    installments: z
      .number()
      .int()
      .min(2, msg("minTwoInstallments"))
      .max(120, msg("max120Installments"))
      .nullable()
      .optional(),
    description: z.string().trim().max(200, msg("descriptionTooLong")).optional(),
    dayOfMonth: dayOfMonthSchema.optional(),
    startMonth: calendarMonthSchema,
    endMonth: calendarMonthSchema.nullable().optional(),
    /** Being recorded now: the first occurrence already happened. */
    postFirst: z.boolean().optional(),
    /**
     * On a card, the purchase date of the first charge: the backend derives
     * the first invoice (startMonth) from the card's closing day.
     */
    startDate: calendarDateSchema.optional(),
  })
  .superRefine((rule, context) => {
    if (!rule.accountId === !rule.cardId) {
      context.addIssue({
        code: "custom",
        message: msg("accountOrCard"),
        path: ["accountId"],
      });
    }
    if (rule.cardId && rule.type !== "EXPENSE") {
      context.addIssue({
        code: "custom",
        message: msg("cardExpenseOnly"),
        path: ["cardId"],
      });
    }
    if (rule.accountId && rule.dayOfMonth === undefined) {
      context.addIssue({
        code: "custom",
        message: msg("dayRequired"),
        path: ["dayOfMonth"],
      });
    }
    if (rule.endMonth && rule.endMonth < rule.startMonth) {
      context.addIssue({
        code: "custom",
        message: msg("endBeforeStart"),
        path: ["endMonth"],
      });
    }
  });

/** Confirming a pending occurrence may adjust what actually happened. */
export const confirmOccurrenceSchema = z.object({
  amount: positiveMinorAmountSchema.optional(),
  date: calendarDateSchema.optional(),
});

/**
 * Editing one occurrence of a recurring rule. It stays part of the rule;
 * "following" also changes the rule for this and the coming months.
 */
export const updateOccurrenceSchema = z.object({
  amount: positiveMinorAmountSchema,
  categoryId: z.string().uuid(msg("chooseCategory")),
  description: z.string().trim().max(200, msg("descriptionTooLong")).optional(),
  date: calendarDateSchema,
  /** Account occurrences only; card ones stay on their card. */
  accountId: z.string().uuid(msg("chooseAccount")).optional(),
  scope: z.enum(["one", "following"]).default("one"),
});

export type UpdateOccurrenceInput = z.infer<typeof updateOccurrenceSchema>;

export const assetClassSchema = z.enum([
  "FIXED_INCOME",
  "STOCK",
  "FII",
  "ETF",
  "CRYPTO",
  "OTHER",
]);

const nonNegativeMinorSchema = moneyAmountSchema.refine(
  (amount) => amount >= 0n,
  msg("amountNegative"),
);

const investmentDetailsSchema = z.object({
  name: nameSchema,
  assetClass: assetClassSchema,
  institutionId: z.string().uuid().nullable().optional(),
  ticker: z.string().trim().max(20, msg("tickerTooLong")).optional(),
  /** Informative; kept as typed text so fractions never become floats. */
  quantity: z
    .string()
    .trim()
    .regex(/^(\d+([.,]\d+)?)?$/, msg("invalidQuantity"))
    .optional(),
  maturityDate: calendarDateSchema.nullable().optional(),
  product: z
    .enum([
      "CDB",
      "LCI",
      "LCA",
      "TESOURO_SELIC",
      "TESOURO_IPCA",
      "TESOURO_PREFIXADO",
      "DEBENTURE",
      "CRI_CRA",
      "FUND",
      "OTHER",
    ])
    .nullable()
    .optional(),
  indexer: z.enum(["CDI", "IPCA", "PREFIXED", "SELIC"]).nullable().optional(),
  /** 11000 = 110% do CDI; 650 = IPCA + 6,5%; 1200 = 12% a.a. */
  rateBps: z
    .number()
    .int()
    .min(0, msg("invalidRate"))
    .max(100000, msg("invalidRate"))
    .nullable()
    .optional(),
  liquidity: z.enum(["DAILY", "AT_MATURITY"]).nullable().optional(),
});

export const createInvestmentSchema = investmentDetailsSchema.extend({
  /**
   * Already applied before tracking started; not an expense. Omitted when
   * the user only knows today's value: then it equals `currentValue` and the
   * gain is measured from the moment of registration.
   */
  openingApplied: nonNegativeMinorSchema.optional(),
  currentValue: nonNegativeMinorSchema,
  /** Only meaningful with `openingApplied`. */
  startDate: calendarDateSchema.optional(),
});

export const updateInvestmentSchema = investmentDetailsSchema;

/** Today's value of several positions at once. */
export const bulkValuationSchema = z.object({
  date: calendarDateSchema,
  items: z
    .array(
      z.object({
        investmentId: z.string().uuid(),
        value: nonNegativeMinorSchema,
      }),
    )
    .min(1, msg("nothingToUpdate"))
    .max(200),
});

export const investmentMovementSchema = z.object({
  type: z.enum(["INVESTMENT", "REDEMPTION"]),
  accountId: z.string().uuid(msg("chooseAccount")),
  amount: positiveMinorAmountSchema,
  date: calendarDateSchema,
});

export const valuationSchema = z.object({
  value: nonNegativeMinorSchema,
  date: calendarDateSchema,
});

export const budgetSchema = z.object({
  categoryId: z.string().uuid(msg("chooseCategory")),
  amount: positiveMinorAmountSchema,
});

export const goalSchema = z.object({
  name: nameSchema,
  target: positiveMinorAmountSchema,
  targetDate: calendarDateSchema.nullable().optional(),
  manualSaved: moneyAmountSchema
    .refine((amount) => amount >= 0n, msg("amountNegative"))
    .optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, msg("invalidColor")),
  accountIds: z.array(z.string().uuid()).max(20).optional(),
  investmentIds: z.array(z.string().uuid()).max(50).optional(),
});

export type GoalInput = z.infer<typeof goalSchema>;

export const importPreviewSchema = z.object({
  accountId: z.string().uuid(msg("chooseAccount")),
  format: z.enum(["OFX", "CSV"]),
  /** File text; 5 MB is far beyond any monthly statement. */
  content: z.string().min(1, msg("emptyFile")).max(5_000_000, msg("fileTooBig")),
  mapping: z
    .object({
      date: z.number().int().min(0),
      description: z.number().int().min(0),
      amount: z.number().int().min(0),
      invert: z.boolean().optional(),
    })
    .optional(),
});

export const importCommitSchema = z.object({
  accountId: z.string().uuid(msg("chooseAccount")),
  source: z.enum(["OFX_IMPORT", "CSV_IMPORT"]),
  rows: z
    .array(
      z.object({
        date: calendarDateSchema,
        description: z.string().trim().max(200),
        /** Signed: negative left the account. */
        amount: moneyAmountSchema.refine((v) => v !== 0n, msg("amountZero")),
        categoryId: z.string().uuid(msg("chooseCategory")),
        externalId: z.string().max(255).nullable().optional(),
      }),
    )
    .min(1, msg("nothingToImport"))
    .max(2000, msg("importTooMany")),
});

/** Edits replace the whole entry, so they follow the same rules as creation. */
export const updateTransactionSchema = createTransactionSchema;

export type CreateInvestmentInput = z.infer<typeof createInvestmentSchema>;
export type InstitutionInput = z.infer<typeof institutionSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreditCardInput = z.infer<typeof creditCardSchema>;
export type CardPurchaseInput = z.infer<typeof cardPurchaseSchema>;
export type CardPaymentInput = z.infer<typeof cardPaymentSchema>;
export type RecurringRuleInput = z.infer<typeof recurringRuleSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const themeSchema = z.enum(["DARK", "LIGHT", "SYSTEM"]);

/**
 * Accent colors offered in Settings. A short fixed list keeps the app
 * consistent; each one has a dark and a light step in tokens.css.
 */
export const accentSchema = z.enum(["GOLD", "GREEN", "BLUE", "VIOLET", "ROSE"]);

export const onboardingStateSchema = z.object({
  completed: z.boolean(),
  /** Free-form id of the current step; null before it starts or once done. */
  step: z.string().trim().min(1).max(40).nullable(),
  skipped: z.boolean(),
});

/** Ids of tips already dismissed; repeated ids collapse into one. */
const tipsSeenSchema = z
  .array(z.string().trim().min(1).max(64))
  .max(200, msg("tooManyTips"))
  .transform((ids) => [...new Set(ids)]);

export const preferencesSchema = z.object({
  theme: themeSchema,
  accent: accentSchema,
  locale: localeSchema,
  currency: currencyCodeSchema,
  /** Day the "financial month" starts. Capped at 28 so every month has it. */
  monthStartDay: z
    .number({ error: msg("monthStartDay") })
    .int(msg("monthStartDay"))
    .min(1, msg("monthStartDay"))
    .max(28, msg("monthStartDay")),
  hideValues: z.boolean(),
  onboardingState: onboardingStateSchema,
  tipsSeen: tipsSeenSchema,
});

/** Only the fields sent change; each one is replaced as a whole. */
export const updatePreferencesSchema = preferencesSchema.partial();

export type Theme = z.infer<typeof themeSchema>;
export type Accent = z.infer<typeof accentSchema>;
export type OnboardingState = z.infer<typeof onboardingStateSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "DARK",
  accent: "GOLD",
  locale: DEFAULT_LOCALE,
  currency: INITIAL_CURRENCY,
  monthStartDay: 1,
  hideValues: false,
  onboardingState: { completed: false, step: null, skipped: false },
  tipsSeen: [],
};

export const serviceHealthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.literal("nublar-api"),
  database: z.enum(["up", "down"]),
});

export type ServiceHealth = z.infer<typeof serviceHealthSchema>;
