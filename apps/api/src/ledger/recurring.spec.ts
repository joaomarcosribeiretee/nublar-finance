import {
  occurrenceAmount,
  occurrenceDate,
  occurrenceMonths,
  planEndMonth,
} from './recurring';

describe('recurring schedules', () => {
  const rent = { dayOfMonth: 31, startMonth: '2026-08', endMonth: null };

  it('produces one occurrence per month from the start', () => {
    expect(occurrenceMonths(rent, '2026-07', '2026-10')).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
  });

  it('stops at the end month', () => {
    expect(
      occurrenceMonths({ ...rent, endMonth: '2026-09' }, '2026-01', '2026-12'),
    ).toEqual(['2026-08', '2026-09']);
  });

  it('produces nothing outside the window', () => {
    expect(occurrenceMonths(rent, '2026-01', '2026-07')).toEqual([]);
  });

  it('falls back to the last day in short months', () => {
    expect(occurrenceDate(rent, '2026-09')).toBe('2026-09-30');
    expect(occurrenceDate(rent, '2026-10')).toBe('2026-10-31');
  });

  it('splits an installment plan with the leftover cent first', () => {
    const plan = {
      dayOfMonth: 10,
      startMonth: '2026-11',
      endMonth: null,
      amount: 100000n,
      installments: 3,
    };
    expect(planEndMonth(plan)).toBe('2027-01');
    expect(occurrenceAmount(plan, '2026-11')).toEqual({
      amount: 33334n,
      installmentNumber: 1,
      installmentCount: 3,
    });
    expect(occurrenceAmount(plan, '2027-01').amount).toBe(33333n);
  });

  it('keeps the same amount every month for a fixed cost', () => {
    const plan = { ...rent, amount: 4590n, installments: null };
    expect(occurrenceAmount(plan, '2027-05')).toEqual({
      amount: 4590n,
      installmentNumber: null,
      installmentCount: null,
    });
  });
});
