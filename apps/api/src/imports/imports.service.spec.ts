import { findDuplicates } from './imports.service';

describe('findDuplicates', () => {
  const row = (
    date: string,
    amount: bigint,
    externalId: string | null = null,
  ) => ({
    date,
    amount,
    description: 'x',
    externalId,
  });

  it('matches by bank id or by same day and amount', () => {
    expect(
      findDuplicates(
        [
          row('2026-10-01', -4590n, 'fit1'),
          row('2026-10-02', -1000n),
          row('2026-10-03', -1000n),
        ],
        [
          { date: '2026-09-01', amount: -1n, importKey: 'fit1' },
          { date: '2026-10-02', amount: -1000n, importKey: null },
        ],
      ),
    ).toEqual([true, true, false]);
  });

  it('lets one existing entry explain only one imported row', () => {
    expect(
      findDuplicates(
        [row('2026-10-02', -1000n), row('2026-10-02', -1000n)],
        [{ date: '2026-10-02', amount: -1000n, importKey: null }],
      ),
    ).toEqual([true, false]);
  });
});
