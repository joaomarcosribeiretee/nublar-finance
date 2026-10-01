import {
  dayOf,
  invoiceDates,
  invoiceMonthFor,
  invoiceStatus,
  splitInstallments,
} from './cards';

describe('credit card rules', () => {
  const closes3due10 = { closingDay: 3, dueDay: 10 };
  const closes28due5 = { closingDay: 28, dueDay: 5 };

  it('puts a purchase before closing into the invoice due that cycle', () => {
    expect(invoiceMonthFor('2026-09-25', closes3due10)).toBe('2026-10');
    expect(invoiceMonthFor('2026-10-02', closes3due10)).toBe('2026-10');
  });

  it('moves a purchase on or after the closing day to the next invoice', () => {
    expect(invoiceMonthFor('2026-10-03', closes3due10)).toBe('2026-11');
    expect(invoiceMonthFor('2026-10-20', closes3due10)).toBe('2026-11');
  });

  it('handles cards that are due the month after closing', () => {
    expect(invoiceMonthFor('2026-09-20', closes28due5)).toBe('2026-10');
    expect(invoiceMonthFor('2026-09-28', closes28due5)).toBe('2026-11');
    expect(invoiceDates('2026-10', closes28due5)).toEqual({
      closingDate: '2026-09-28',
      dueDate: '2026-10-05',
    });
  });

  it('crosses the year boundary', () => {
    expect(invoiceMonthFor('2026-12-15', { closingDay: 10, dueDay: 17 })).toBe(
      '2027-01',
    );
  });

  it('clamps days that a month does not have', () => {
    expect(dayOf('2026-02', 31)).toBe('2026-02-28');
    expect(dayOf('2028-02', 31)).toBe('2028-02-29');
    expect(invoiceMonthFor('2026-02-28', { closingDay: 31, dueDay: 8 })).toBe(
      '2026-04',
    );
  });

  it('puts the leftover cent on the first installment', () => {
    expect(splitInstallments(10000n, 3)).toEqual([3334n, 3333n, 3333n]);
    expect(splitInstallments(600000n, 12)).toEqual(Array(12).fill(50000n));
    const parts = splitInstallments(99999n, 7);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(99999n);
  });

  it('derives invoice status from dates and payments', () => {
    const dates = { closingDate: '2026-10-03', dueDate: '2026-10-10' };
    expect(
      invoiceStatus({ total: 0n, paid: 0n, today: '2026-10-01', ...dates }),
    ).toBe('EMPTY');
    expect(
      invoiceStatus({ total: 100n, paid: 0n, today: '2026-10-01', ...dates }),
    ).toBe('OPEN');
    expect(
      invoiceStatus({ total: 100n, paid: 0n, today: '2026-10-05', ...dates }),
    ).toBe('CLOSED');
    expect(
      invoiceStatus({ total: 100n, paid: 0n, today: '2026-10-11', ...dates }),
    ).toBe('OVERDUE');
    expect(
      invoiceStatus({ total: 100n, paid: 100n, today: '2026-10-11', ...dates }),
    ).toBe('PAID');
  });
});
