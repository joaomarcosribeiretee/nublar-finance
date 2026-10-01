import { thisMonth } from '../common/today';
import type { LedgerEntry } from '../ledger/ledger';
import { shiftMonth } from '../ledger/month';
import { AnalyticsService, average, bps } from './analytics.service';

describe('analytics helpers', () => {
  it('expresses shares in basis points without floats', () => {
    expect(bps(2500n, 10000n)).toBe(2500);
    expect(bps(-500n, 10000n)).toBe(-500);
    expect(bps(1n, 0n)).toBeNull();
  });

  it('averages minor units', () => {
    expect(average([100n, 200n, 301n])).toBe(200n);
    expect(average([])).toBe(0n);
  });
});

describe('AnalyticsService.overview', () => {
  const current = thisMonth();
  const previous = shiftMonth(current, -1);
  const next = shiftMonth(current, 1);
  const itau = 'itau';

  const entries: LedgerEntry[] = [
    {
      type: 'INCOME',
      accountId: itau,
      destinationAccountId: null,
      amount: 500000n,
      date: `${previous}-05`,
    },
    {
      type: 'EXPENSE',
      accountId: itau,
      destinationAccountId: null,
      amount: 100000n,
      date: `${previous}-10`,
      categoryId: 'food',
    },
    {
      type: 'EXPENSE',
      accountId: itau,
      destinationAccountId: null,
      amount: 200000n,
      date: `${current}-01`,
      categoryId: 'home',
      recurring: true,
    },
    {
      type: 'EXPENSE',
      accountId: null,
      destinationAccountId: null,
      amount: 30000n,
      date: `${current}-01`,
      cardId: 'card',
      invoiceMonth: next,
      installmentCount: 2,
      categoryId: 'tech',
    },
  ];

  async function run() {
    const service = new AnalyticsService(
      {
        db: {
          category: {
            findMany: jest.fn().mockResolvedValue([
              { id: 'food', name: 'Alimentação' },
              { id: 'home', name: 'Moradia' },
            ]),
          },
          recurringRule: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'rent',
                type: 'EXPENSE',
                amount: 200000n,
                dayOfMonth: 1,
                startMonth: current,
                endMonth: null,
              },
            ]),
          },
          transaction: { findMany: jest.fn().mockResolvedValue([]) },
        },
      } as never,
      {
        entries: jest.fn().mockResolvedValue(entries),
        accounts: jest
          .fn()
          .mockResolvedValue([{ id: itau, openingBalance: 50000n }]),
        positions: jest.fn().mockResolvedValue([]),
      } as never,
    );
    return service.overview('user', undefined, '3');
  }

  it('builds month series and net worth history', async () => {
    const result = await run();
    expect(result.series.map((p) => p.month)).toEqual([
      shiftMonth(current, -2),
      previous,
      current,
    ]);
    const [, prev, now] = result.series;
    expect(prev.netWorth).toBe('450000');
    expect(prev.savingsRateBps).toBe(8000);
    // The card purchase lowers net worth now, though billed next month.
    expect(now.netWorth).toBe('220000');
    expect(now.cardDebt).toBe('30000');
    expect(now.fixed).toBe('200000');
  });

  it('averages only the months already tracked', async () => {
    const result = await run();
    expect(result.kpis.trackedMonths).toBe(2);
    expect(result.kpis.averageExpense).toBe('150000');
    expect(result.kpis.netWorthChange).toBe('170000');
  });

  it('projects installments and recurring costs into coming months', async () => {
    const result = await run();
    expect(result.commitments[0]).toEqual({
      month: next,
      installments: '30000',
      recurringExpense: '200000',
      recurringIncome: '0',
      balance: '-230000',
    });
  });

  it('compares the month categories with the previous month', async () => {
    const result = await run();
    const food = result.categories.find((c) => c.categoryId === 'food');
    expect(food).toMatchObject({ amount: '0', previous: '100000' });
  });
});
