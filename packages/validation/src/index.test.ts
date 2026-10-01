import { describe, expect, it } from "vitest";
import {
  cardPurchaseSchema,
  createTransactionSchema,
  recurringRuleSchema,
  moneyAmountSchema,
  serviceHealthSchema,
} from "./index";

describe("moneyAmountSchema", () => {
  it("accepts an integer amount in minor units", () => {
    expect(moneyAmountSchema.parse("123456")).toBe(123456n);
  });

  it("rejects a decimal amount", () => {
    expect(moneyAmountSchema.safeParse("1234.56").success).toBe(false);
  });
});

describe("createTransactionSchema", () => {
  const income = {
    type: "INCOME" as const,
    accountId: "6d8f4a2e-1c3b-4e5a-9f70-1a2b3c4d5e6f",
    categoryId: "7e9f5b3f-2d4c-4f6b-8a81-2b3c4d5e6f70",
    amount: "150000",
    date: "2026-09-30",
  };

  it("accepts an income with a category", () => {
    expect(createTransactionSchema.parse(income).amount).toBe(150000n);
  });

  it("rejects a decimal amount", () => {
    expect(
      createTransactionSchema.safeParse({ ...income, amount: "10.50" }).success,
    ).toBe(false);
  });

  it("rejects a day that does not exist", () => {
    expect(
      createTransactionSchema.safeParse({ ...income, date: "2026-02-31" })
        .success,
    ).toBe(false);
  });

  it("rejects a transfer into the same account", () => {
    expect(
      createTransactionSchema.safeParse({
        type: "TRANSFER",
        accountId: income.accountId,
        destinationAccountId: income.accountId,
        amount: "50000",
        date: "2026-09-30",
      }).success,
    ).toBe(false);
  });

  it("rejects a category on a transfer", () => {
    expect(
      createTransactionSchema.safeParse({
        type: "TRANSFER",
        accountId: income.accountId,
        destinationAccountId: income.categoryId,
        categoryId: income.categoryId,
        amount: "50000",
        date: "2026-09-30",
      }).success,
    ).toBe(false);
  });
});

describe("serviceHealthSchema", () => {
  it("accepts the API health contract", () => {
    expect(
      serviceHealthSchema.parse({
        status: "degraded",
        service: "nublar-api",
        database: "down",
      }),
    ).toEqual({
      status: "degraded",
      service: "nublar-api",
      database: "down",
    });
  });
});

describe("phase 2 schemas", () => {
  const ids = {
    card: "6d8f4a2e-1c3b-4e5a-9f70-1a2b3c4d5e6f",
    category: "7e9f5b3f-2d4c-4f6b-8a81-2b3c4d5e6f70",
  };

  it("accepts an installment purchase", () => {
    const parsed = cardPurchaseSchema.parse({
      cardId: ids.card,
      categoryId: ids.category,
      amount: "600000",
      installments: 12,
      date: "2026-10-01",
    });
    expect(parsed.amount).toBe(600000n);
  });

  it("rejects zero installments", () => {
    expect(
      cardPurchaseSchema.safeParse({
        cardId: ids.card,
        categoryId: ids.category,
        amount: "1000",
        installments: 0,
        date: "2026-10-01",
      }).success,
    ).toBe(false);
  });

  it("needs exactly one of account or card", () => {
    const base = {
      type: "EXPENSE",
      categoryId: ids.category,
      amount: "4590",
      startMonth: "2026-10",
    };
    expect(recurringRuleSchema.safeParse(base).success).toBe(false);
    expect(
      recurringRuleSchema.safeParse({ ...base, cardId: ids.card }).success,
    ).toBe(true);
    expect(
      recurringRuleSchema.safeParse({
        ...base,
        cardId: ids.card,
        accountId: ids.card,
        dayOfMonth: 5,
      }).success,
    ).toBe(false);
  });

  it("rejects a recurrence that ends before it starts", () => {
    expect(
      recurringRuleSchema.safeParse({
        type: "EXPENSE",
        accountId: ids.card,
        categoryId: ids.category,
        amount: "4500",
        dayOfMonth: 8,
        startMonth: "2026-10",
        endMonth: "2026-09",
      }).success,
    ).toBe(false);
  });
});
