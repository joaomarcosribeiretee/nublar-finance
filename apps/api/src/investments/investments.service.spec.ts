import { fixedIncomeSummary } from './investments.service';

describe('fixedIncomeSummary', () => {
  const base = { assetClass: 'FIXED_INCOME', maturityDate: null };

  it('splits fixed income by liquidity and ignores other classes', () => {
    const summary = fixedIncomeSummary(
      [
        {
          ...base,
          id: 'a',
          name: 'CDB liquidez',
          current: '1000000',
          liquidity: 'DAILY',
        },
        {
          ...base,
          id: 'b',
          name: 'LCI',
          current: '500000',
          liquidity: 'AT_MATURITY',
        },
        {
          ...base,
          id: 'c',
          name: 'Tesouro',
          current: '200000',
          liquidity: null,
        },
        {
          ...base,
          id: 'd',
          name: 'Ação',
          assetClass: 'STOCK',
          current: '900000',
          liquidity: null,
        },
      ],
      '2026-10-02',
    );
    expect(summary).toMatchObject({
      daily: '1000000',
      atMaturity: '500000',
      unknown: '200000',
    });
  });

  it('lists maturities of the next twelve months, soonest first', () => {
    const summary = fixedIncomeSummary(
      [
        {
          ...base,
          id: 'late',
          name: 'Longo',
          current: '1',
          liquidity: null,
          maturityDate: '2028-01-01',
        },
        {
          ...base,
          id: 'b',
          name: 'B',
          current: '2',
          liquidity: null,
          maturityDate: '2027-03-10',
        },
        {
          ...base,
          id: 'a',
          name: 'A',
          current: '3',
          liquidity: null,
          maturityDate: '2026-12-01',
        },
        {
          ...base,
          id: 'past',
          name: 'Venceu',
          current: '4',
          liquidity: null,
          maturityDate: '2026-01-01',
        },
      ],
      '2026-10-02',
    );
    expect(summary.maturities.map((m) => m.id)).toEqual(['a', 'b']);
  });
});
