import { monthRange, shiftMonth } from './month';

describe('month helpers', () => {
  it('crosses year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-10', 0)).toBe('2026-10');
  });

  it('covers the whole month and nothing after', () => {
    const range = monthRange('2026-02');
    expect(range.gte.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(range.lt.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });
});
