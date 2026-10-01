import { investmentPerformance, investmentValueAt } from './investments';

describe('investment rules', () => {
  const valuations = [
    { date: '2026-01-10', value: 100000n },
    { date: '2026-06-30', value: 112000n },
  ];
  const movements = [
    { type: 'INVESTMENT' as const, amount: 20000n, date: '2026-03-05' },
    { type: 'INVESTMENT' as const, amount: 10000n, date: '2026-07-01' },
    { type: 'REDEMPTION' as const, amount: 5000n, date: '2026-08-15' },
  ];

  it('is zero before the first valuation', () => {
    expect(investmentValueAt(valuations, [], '2025-12-31')).toBe(0n);
  });

  it('adds movements made after the latest valuation', () => {
    expect(investmentValueAt(valuations, movements, '2026-03-31')).toBe(
      120000n,
    );
    expect(investmentValueAt(valuations, movements, '2026-09-01')).toBe(
      117000n,
    );
  });

  it('treats a valuation as already including earlier movements', () => {
    // The March contribution happened before the June valuation.
    expect(investmentValueAt(valuations, movements, '2026-06-30')).toBe(
      112000n,
    );
  });

  it('counts a same-day contribution recorded after the valuation', () => {
    const sameDay = [
      { date: '2026-10-01', value: 100000n, createdAt: '2026-10-01T10:00:00Z' },
    ];
    const contribution = {
      type: 'INVESTMENT' as const,
      amount: 5000n,
      date: '2026-10-01',
    };
    expect(
      investmentValueAt(
        sameDay,
        [{ ...contribution, createdAt: '2026-10-01T11:00:00Z' }],
        '2026-10-01',
      ),
    ).toBe(105000n);
    expect(
      investmentValueAt(
        sameDay,
        [{ ...contribution, createdAt: '2026-10-01T09:00:00Z' }],
        '2026-10-01',
      ),
    ).toBe(100000n);
  });

  it('measures gain as value plus redeemed minus applied', () => {
    const performance = investmentPerformance({
      openingApplied: 100000n,
      valuations,
      movements,
      today: '2026-09-01',
    });
    expect(performance.applied).toBe(130000n);
    expect(performance.redeemed).toBe(5000n);
    expect(performance.current).toBe(117000n);
    expect(performance.gain).toBe(-8000n);
    expect(performance.gainBps).toBe(-615);
  });

  it('reports no percentage when nothing was applied', () => {
    expect(
      investmentPerformance({
        openingApplied: 0n,
        valuations: [],
        movements: [],
        today: '2026-09-01',
      }).gainBps,
    ).toBeNull();
  });
});
