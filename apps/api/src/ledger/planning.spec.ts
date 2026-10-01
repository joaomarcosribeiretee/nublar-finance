import { budgetStatus, goalPlan, monthsUntil, projectCash } from './planning';

describe('planning rules', () => {
  it('warns at 80% and flags overspending', () => {
    expect(budgetStatus(50000n, 100000n)).toEqual({
      remaining: 50000n,
      usedBps: 5000,
      status: 'OK',
    });
    expect(budgetStatus(80000n, 100000n).status).toBe('WARNING');
    expect(budgetStatus(100001n, 100000n)).toMatchObject({
      remaining: -1n,
      status: 'OVER',
    });
  });

  it('counts the current month when planning a goal', () => {
    expect(monthsUntil('2026-10-15', '2027-03-01')).toBe(6);
    expect(monthsUntil('2026-10-15', '2026-10-31')).toBe(1);
    expect(monthsUntil('2026-10-15', '2026-09-01')).toBe(0);
  });

  it('rounds the monthly amount up so the plan reaches the goal', () => {
    const plan = goalPlan({
      target: 1000000n,
      saved: 400000n,
      targetDate: '2027-03-01',
      today: '2026-10-15',
    });
    expect(plan.remaining).toBe(600000n);
    expect(plan.progressBps).toBe(4000);
    expect(plan.monthlyNeeded).toBe(100000n);

    expect(
      goalPlan({
        target: 100n,
        saved: 0n,
        targetDate: '2026-12-01',
        today: '2026-10-15',
      }).monthlyNeeded,
    ).toBe(34n);
  });

  it('marks reached and late goals', () => {
    expect(
      goalPlan({
        target: 100n,
        saved: 150n,
        targetDate: null,
        today: '2026-10-15',
      }),
    ).toMatchObject({ reached: true, progressBps: 10000, monthlyNeeded: null });
    expect(
      goalPlan({
        target: 100n,
        saved: 10n,
        targetDate: '2026-09-01',
        today: '2026-10-15',
      }).late,
    ).toBe(true);
  });

  it('accumulates the projected cash month after month', () => {
    const projection = projectCash(100000n, [
      {
        month: '2026-11',
        income: 500000n,
        fixed: 200000n,
        installments: 30000n,
        variableEstimate: 150000n,
      },
      {
        month: '2026-12',
        income: 500000n,
        fixed: 200000n,
        installments: 0n,
        variableEstimate: 150000n,
      },
    ]);
    expect(projection.map((p) => p.projectedCash)).toEqual([220000n, 370000n]);
  });
});
