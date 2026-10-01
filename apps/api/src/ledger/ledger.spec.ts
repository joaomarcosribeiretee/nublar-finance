import {
  availableCash,
  balanceOf,
  cardDebt,
  invoiceTotals,
  monthExpenseByCategory,
  monthExpenseComposition,
  monthInvested,
  monthIncomeAndExpense,
  netWorth,
} from './ledger';
import type { LedgerEntry } from './ledger';

const itau = 'itau';
const nubank = 'nubank';

function entry(partial: LedgerEntry): LedgerEntry {
  return partial;
}

describe('ledger', () => {
  const entries: LedgerEntry[] = [
    entry({
      type: 'INCOME',
      accountId: itau,
      destinationAccountId: null,
      amount: 500000n,
      date: '2026-09-05',
    }),
    entry({
      type: 'EXPENSE',
      accountId: itau,
      destinationAccountId: null,
      amount: 80000n,
      date: '2026-09-10',
    }),
    entry({
      type: 'TRANSFER',
      accountId: itau,
      destinationAccountId: nubank,
      amount: 50000n,
      date: '2026-09-12',
    }),
  ];

  it('moves money between accounts without changing net worth', () => {
    expect(balanceOf(itau, entries)).toBe(370000n);
    expect(balanceOf(nubank, entries)).toBe(50000n);
    expect(
      netWorth(
        [
          { id: itau, openingBalance: 0n },
          { id: nubank, openingBalance: 0n },
        ],
        entries,
      ),
    ).toBe(420000n);
  });

  it('counts opening balances in net worth but not as income', () => {
    const accounts = [
      { id: itau, openingBalance: 100000n },
      { id: nubank, openingBalance: -2000n },
    ];
    expect(netWorth(accounts, entries)).toBe(518000n);
    expect(monthIncomeAndExpense(entries, '2026-09').income).toBe(500000n);
  });

  it('does not count a transfer as income or expense', () => {
    expect(monthIncomeAndExpense(entries, '2026-09')).toEqual({
      income: 500000n,
      expense: 80000n,
    });
  });

  it('groups month expenses by category, largest first', () => {
    const withCategories: LedgerEntry[] = [
      ...entries,
      entry({
        type: 'EXPENSE',
        accountId: itau,
        destinationAccountId: null,
        amount: 3000n,
        date: '2026-09-11',
        categoryId: 'food',
      }),
      entry({
        type: 'EXPENSE',
        accountId: itau,
        destinationAccountId: null,
        amount: 9000n,
        date: '2026-09-14',
        categoryId: 'home',
      }),
      entry({
        type: 'EXPENSE',
        accountId: itau,
        destinationAccountId: null,
        amount: 2000n,
        date: '2026-09-20',
        categoryId: 'food',
      }),
      entry({
        type: 'EXPENSE',
        accountId: itau,
        destinationAccountId: null,
        amount: 7000n,
        date: '2026-10-01',
        categoryId: 'food',
      }),
    ];

    expect(monthExpenseByCategory(withCategories, '2026-09')).toEqual([
      { categoryId: null, amount: 80000n },
      { categoryId: 'home', amount: 9000n },
      { categoryId: 'food', amount: 5000n },
    ]);
  });

  describe('credit cards', () => {
    const card = 'card';
    const accounts = [{ id: itau, openingBalance: 100000n }];
    const installment = (
      amount: bigint,
      invoiceMonth: string,
    ): LedgerEntry => ({
      type: 'EXPENSE',
      accountId: null,
      destinationAccountId: null,
      amount,
      date: '2026-09-20',
      cardId: card,
      invoiceMonth,
      categoryId: 'tech',
    });
    const cardEntries: LedgerEntry[] = [
      installment(3334n, '2026-10'),
      installment(3333n, '2026-11'),
      installment(3333n, '2026-12'),
      {
        type: 'CARD_PAYMENT',
        accountId: itau,
        destinationAccountId: null,
        amount: 3334n,
        date: '2026-10-10',
        cardId: card,
        invoiceMonth: '2026-10',
      },
    ];

    it('counts card expenses in the invoice month, not the purchase month', () => {
      expect(monthIncomeAndExpense(cardEntries, '2026-09').expense).toBe(0n);
      expect(monthIncomeAndExpense(cardEntries, '2026-10').expense).toBe(3334n);
      expect(monthExpenseByCategory(cardEntries, '2026-11')).toEqual([
        { categoryId: 'tech', amount: 3333n },
      ]);
    });

    it('does not count an invoice payment as an expense', () => {
      expect(monthIncomeAndExpense(cardEntries, '2026-10').expense).toBe(3334n);
    });

    it('treats the whole remaining purchase as card debt', () => {
      expect(cardDebt(card, cardEntries)).toBe(6666n);
      expect(balanceOf(itau, cardEntries)).toBe(-3334n);
      expect(availableCash(accounts, cardEntries)).toBe(96666n);
      expect(netWorth(accounts, cardEntries)).toBe(90000n);
    });

    it('reports billed and paid per invoice', () => {
      expect(invoiceTotals(card, '2026-10', cardEntries)).toEqual({
        total: 3334n,
        paid: 3334n,
      });
      expect(invoiceTotals(card, '2026-11', cardEntries)).toEqual({
        total: 3333n,
        paid: 0n,
      });
    });
  });

  it('ignores pending and canceled entries until confirmed', () => {
    const pending: LedgerEntry[] = [
      {
        type: 'EXPENSE',
        accountId: itau,
        destinationAccountId: null,
        amount: 150000n,
        date: '2026-09-10',
        status: 'PENDING',
      },
      {
        type: 'INCOME',
        accountId: itau,
        destinationAccountId: null,
        amount: 850000n,
        date: '2026-09-05',
        status: 'CANCELED',
      },
    ];
    expect(balanceOf(itau, pending)).toBe(0n);
    expect(monthIncomeAndExpense(pending, '2026-09')).toEqual({
      income: 0n,
      expense: 0n,
    });
  });

  it('moves money into and out of investments without touching net worth', () => {
    const moves: LedgerEntry[] = [
      {
        type: 'INVESTMENT',
        accountId: itau,
        destinationAccountId: null,
        amount: 30000n,
        date: '2026-09-15',
      },
      {
        type: 'REDEMPTION',
        accountId: itau,
        destinationAccountId: null,
        amount: 10000n,
        date: '2026-09-20',
      },
    ];
    const accounts = [{ id: itau, openingBalance: 100000n }];
    expect(balanceOf(itau, moves)).toBe(-20000n);
    // The 20000 now sits in the investment.
    expect(netWorth(accounts, moves, 20000n)).toBe(100000n);
    expect(monthInvested(moves, '2026-09')).toBe(20000n);
    expect(monthIncomeAndExpense(moves, '2026-09')).toEqual({
      income: 0n,
      expense: 0n,
    });
  });

  it('splits expenses into fixed, installments and variable', () => {
    const base = {
      type: 'EXPENSE' as const,
      destinationAccountId: null,
      date: '2026-09-10',
    };
    const mixed: LedgerEntry[] = [
      { ...base, accountId: itau, amount: 150000n, recurring: true },
      {
        ...base,
        accountId: null,
        amount: 50000n,
        cardId: 'card',
        invoiceMonth: '2026-09',
        installmentCount: 12,
      },
      {
        ...base,
        accountId: null,
        amount: 8000n,
        cardId: 'card',
        invoiceMonth: '2026-09',
        installmentCount: 1,
      },
      { ...base, accountId: itau, amount: 4000n },
    ];
    expect(monthExpenseComposition(mixed, '2026-09')).toEqual({
      fixed: 150000n,
      installments: 50000n,
      variable: 12000n,
    });
  });
});
