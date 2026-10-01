import { INITIAL_CURRENCY } from "@nublar/types";
import { z } from "zod";

export const currencyCodeSchema = z.literal(INITIAL_CURRENCY);

/**
 * Integer amount in the currency minor unit (centavos for BRL).
 * Decimal strings such as "1234.56" are rejected.
 */
export const moneyAmountSchema = z
  .string()
  .regex(/^-?\d+$/, "Valor deve ser inteiro em centavos")
  .transform((value) => BigInt(value));

export const positiveMinorAmountSchema = moneyAmountSchema.refine(
  (amount) => amount > 0n,
  "Valor deve ser maior que zero",
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
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .refine((value) => {
    // Date rolls 2026-02-31 over into March, so compare the round trip.
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Data inválida");

export const calendarMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês deve usar AAAA-MM");

const nameSchema = z
  .string()
  .trim()
  .min(1, "Informe um nome")
  .max(80, "Nome muito longo");

/** What the account held before tracking started. May be negative (overdraft). */
const openingBalanceSchema = moneyAmountSchema;

export const institutionSchema = z.object({
  name: nameSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
});

/** Nickname is optional: without one the account reads as its type. */
const nicknameSchema = z.string().trim().max(80, "Nome muito longo");

const institutionIdSchema = z.string().uuid("Instituição inválida").nullable();

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
    accountId: z.string().uuid("Escolha uma conta"),
    destinationAccountId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    amount: positiveMinorAmountSchema,
    description: z.string().trim().max(200, "Descrição muito longa").optional(),
    date: calendarDateSchema,
  })
  .superRefine((value, context) => {
    if (value.type === "TRANSFER") {
      if (!value.destinationAccountId) {
        context.addIssue({
          code: "custom",
          message: "Escolha a conta de destino",
          path: ["destinationAccountId"],
        });
      }
      if (value.destinationAccountId === value.accountId) {
        context.addIssue({
          code: "custom",
          message: "Contas de origem e destino devem ser diferentes",
          path: ["destinationAccountId"],
        });
      }
      if (value.categoryId) {
        context.addIssue({
          code: "custom",
          message: "Transferências não têm categoria",
          path: ["categoryId"],
        });
      }
      return;
    }

    if (!value.categoryId) {
      context.addIssue({
        code: "custom",
        message: "Escolha uma categoria",
        path: ["categoryId"],
      });
    }
    if (value.destinationAccountId) {
      context.addIssue({
        code: "custom",
        message: "Somente transferências têm conta de destino",
        path: ["destinationAccountId"],
      });
    }
  });

const dayOfMonthSchema = z
  .number({ error: "Informe um dia entre 1 e 31" })
  .int("Informe um dia entre 1 e 31")
  .min(1, "Informe um dia entre 1 e 31")
  .max(31, "Informe um dia entre 1 e 31");

export const creditCardSchema = z.object({
  name: nameSchema,
  limit: moneyAmountSchema.refine((v) => v >= 0n, "Limite não pode ser negativo"),
  closingDay: dayOfMonthSchema,
  dueDay: dayOfMonthSchema,
  paymentAccountId: z.string().uuid().nullable().optional(),
  institutionId: institutionIdSchema.optional(),
});

export const cardPurchaseSchema = z.object({
  cardId: z.string().uuid("Escolha um cartão"),
  categoryId: z.string().uuid("Escolha uma categoria"),
  amount: positiveMinorAmountSchema,
  installments: z
    .number()
    .int()
    .min(1, "Mínimo 1 parcela")
    .max(48, "Máximo 48 parcelas"),
  description: z.string().trim().max(200, "Descrição muito longa").optional(),
  date: calendarDateSchema,
});

export const cardPaymentSchema = z.object({
  accountId: z.string().uuid("Escolha uma conta"),
  amount: positiveMinorAmountSchema,
  date: calendarDateSchema,
  invoiceMonth: calendarMonthSchema,
});

export const recurringRuleSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE"]),
    accountId: z.string().uuid("Escolha uma conta").nullable().optional(),
    /** On a card the charge lands on every invoice; no day is needed. */
    cardId: z.string().uuid("Escolha um cartão").nullable().optional(),
    categoryId: z.string().uuid("Escolha uma categoria"),
    /** Per month, or the total when `installments` is set. */
    amount: positiveMinorAmountSchema,
    installments: z
      .number()
      .int()
      .min(2, "Parcelado precisa de ao menos 2 parcelas")
      .max(120, "Máximo 120 parcelas")
      .nullable()
      .optional(),
    description: z.string().trim().max(200, "Descrição muito longa").optional(),
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
        message: "Escolha uma conta ou um cartão",
        path: ["accountId"],
      });
    }
    if (rule.cardId && rule.type !== "EXPENSE") {
      context.addIssue({
        code: "custom",
        message: "Cartão só tem despesas",
        path: ["cardId"],
      });
    }
    if (rule.accountId && rule.dayOfMonth === undefined) {
      context.addIssue({
        code: "custom",
        message: "Informe o dia do mês",
        path: ["dayOfMonth"],
      });
    }
    if (rule.endMonth && rule.endMonth < rule.startMonth) {
      context.addIssue({
        code: "custom",
        message: "O fim precisa ser depois do início",
        path: ["endMonth"],
      });
    }
  });

/** Confirming a pending occurrence may adjust what actually happened. */
export const confirmOccurrenceSchema = z.object({
  amount: positiveMinorAmountSchema.optional(),
  date: calendarDateSchema.optional(),
});

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
  "Valor não pode ser negativo",
);

const investmentDetailsSchema = z.object({
  name: nameSchema,
  assetClass: assetClassSchema,
  institutionId: z.string().uuid().nullable().optional(),
  ticker: z.string().trim().max(20, "Código muito longo").optional(),
  /** Informative; kept as typed text so fractions never become floats. */
  quantity: z
    .string()
    .trim()
    .regex(/^(\d+([.,]\d+)?)?$/, "Quantidade inválida")
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
    .min(0, "Taxa inválida")
    .max(100000, "Taxa inválida")
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
    .min(1, "Nada para atualizar")
    .max(200),
});

export const investmentMovementSchema = z.object({
  type: z.enum(["INVESTMENT", "REDEMPTION"]),
  accountId: z.string().uuid("Escolha uma conta"),
  amount: positiveMinorAmountSchema,
  date: calendarDateSchema,
});

export const valuationSchema = z.object({
  value: nonNegativeMinorSchema,
  date: calendarDateSchema,
});

export const budgetSchema = z.object({
  categoryId: z.string().uuid("Escolha uma categoria"),
  amount: positiveMinorAmountSchema,
});

export const goalSchema = z.object({
  name: nameSchema,
  target: positiveMinorAmountSchema,
  targetDate: calendarDateSchema.nullable().optional(),
  manualSaved: moneyAmountSchema
    .refine((amount) => amount >= 0n, "Valor não pode ser negativo")
    .optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
  accountIds: z.array(z.string().uuid()).max(20).optional(),
  investmentIds: z.array(z.string().uuid()).max(50).optional(),
});

export type GoalInput = z.infer<typeof goalSchema>;

export const importPreviewSchema = z.object({
  accountId: z.string().uuid("Escolha uma conta"),
  format: z.enum(["OFX", "CSV"]),
  /** File text; 5 MB is far beyond any monthly statement. */
  content: z.string().min(1, "Arquivo vazio").max(5_000_000, "Arquivo grande demais"),
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
  accountId: z.string().uuid("Escolha uma conta"),
  source: z.enum(["OFX_IMPORT", "CSV_IMPORT"]),
  rows: z
    .array(
      z.object({
        date: calendarDateSchema,
        description: z.string().trim().max(200),
        /** Signed: negative left the account. */
        amount: moneyAmountSchema.refine((v) => v !== 0n, "Valor zerado"),
        categoryId: z.string().uuid("Escolha uma categoria"),
        externalId: z.string().max(255).nullable().optional(),
      }),
    )
    .min(1, "Nada para importar")
    .max(2000, "Importe no máximo 2.000 lançamentos por vez"),
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

export const serviceHealthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.literal("nublar-api"),
  database: z.enum(["up", "down"]),
});

export type ServiceHealth = z.infer<typeof serviceHealthSchema>;
