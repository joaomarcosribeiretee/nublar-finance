import { today } from './today';

describe('today', () => {
  it('uses the Brazilian calendar day, not UTC', () => {
    // 23:30 in São Paulo on Oct 1st is already Oct 2nd in UTC.
    expect(today(new Date('2026-10-02T02:30:00Z'))).toBe('2026-10-01');
  });
});
