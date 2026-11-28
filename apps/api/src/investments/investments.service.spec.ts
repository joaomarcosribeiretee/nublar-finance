import { BadRequestException } from '@nestjs/common';
import {
  fixedIncomeSummary,
  movedUnits,
  quantityOf,
  shiftQuantity,
  quoteOf,
  storedQuantity,
} from './investments.service';

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

describe('quoteOf', () => {
  const fetchedAt = new Date('2026-11-27T12:00:00.000Z');
  const board = {
    quotes: new Map([['bitcoin', { price: '512345.12', fetchedAt }]]),
    stale: false,
  };

  it('is null for positions with manual values', () => {
    expect(
      quoteOf({ coinId: 'bitcoin', autoQuote: false }, board).quote,
    ).toBeNull();
  });

  it('shows the price and when it was fetched', () => {
    expect(
      quoteOf({ coinId: 'bitcoin', autoQuote: true }, board).quote,
    ).toEqual({
      price: '512345.12',
      fetchedAt: fetchedAt.toISOString(),
      stale: false,
    });
  });

  it('flags a missing quote as stale instead of showing zero', () => {
    expect(quoteOf({ coinId: 'solana', autoQuote: true }, board).quote).toEqual(
      { price: null, fetchedAt: null, stale: true },
    );
  });
});

describe('bitcoin quantity in sats', () => {
  const btc = { assetClass: 'CRYPTO', coinId: 'bitcoin' };

  it('stores bitcoin as whole sats and no typed text', () => {
    expect(storedQuantity({ ...btc, quantity: '0,5' })).toEqual({
      quantity: '',
      sats: 50_000_000n,
    });
    expect(storedQuantity({ ...btc, quantity: '0.00000001' })).toEqual({
      quantity: '',
      sats: 1n,
    });
  });

  it('keeps other positions as typed', () => {
    expect(
      storedQuantity({
        assetClass: 'CRYPTO',
        coinId: 'ethereum',
        quantity: '1,5',
      }),
    ).toEqual({ quantity: '1,5', sats: null });
    // A BTC coin outside crypto is not a coin at all.
    expect(
      storedQuantity({
        assetClass: 'STOCK',
        coinId: 'bitcoin',
        quantity: '100',
      }),
    ).toEqual({ quantity: '100', sats: null });
    expect(storedQuantity({ ...btc, quantity: '' })).toEqual({
      quantity: '',
      sats: null,
    });
  });

  it('refuses less than one sat', () => {
    expect(() => storedQuantity({ ...btc, quantity: '0.000000001' })).toThrow();
  });

  it('shows sats back as BTC text', () => {
    expect(quantityOf({ quantity: '', sats: 12_345n })).toBe('0.00012345');
    expect(quantityOf({ quantity: '100', sats: null })).toBe('100');
  });
});

describe('movedUnits', () => {
  const coin = 10n ** 18n;
  const btc = {
    assetClass: 'CRYPTO',
    coinId: 'bitcoin',
    quantity: '',
    sats: 50_000_000n,
  };

  it('reads the coins a crypto movement carries', () => {
    expect(movedUnits(btc, '0,25')).toBe(coin / 4n);
    expect(
      movedUnits(
        { ...btc, coinId: 'ethereum', sats: null, quantity: '2' },
        '0.000000000000000001',
      ),
    ).toBe(1n);
  });

  it('asks for the quantity when the position tracks one', () => {
    expect(() => movedUnits(btc, undefined)).toThrow(BadRequestException);
    expect(
      movedUnits({ ...btc, coinId: null, sats: null, quantity: '' }, undefined),
    ).toBeNull();
  });

  it('refuses less than one sat and ignores quantities outside crypto', () => {
    expect(() => movedUnits(btc, '0.000000001')).toThrow(BadRequestException);
    expect(
      movedUnits(
        {
          ...btc,
          assetClass: 'STOCK',
          coinId: null,
          sats: null,
          quantity: '100',
        },
        '10',
      ),
    ).toBeNull();
  });
});

describe('shiftQuantity', () => {
  const coin = 10n ** 18n;

  it('adds and removes bitcoin in whole sats', () => {
    const btc = {
      assetClass: 'CRYPTO',
      coinId: 'bitcoin',
      quantity: '',
      sats: 50_000_000n,
    };
    expect(shiftQuantity(btc, coin / 4n)).toEqual({
      quantity: '',
      sats: 75_000_000n,
    });
    expect(shiftQuantity(btc, -coin / 2n)).toEqual({ quantity: '', sats: 0n });
  });

  it('keeps other coins as decimal text', () => {
    const eth = {
      assetClass: 'CRYPTO',
      coinId: 'ethereum',
      quantity: '1,5',
      sats: null,
    };
    expect(shiftQuantity(eth, coin / 2n)).toEqual({
      quantity: '2',
      sats: null,
    });
  });

  it('refuses to hold fewer coins than zero', () => {
    const eth = {
      assetClass: 'CRYPTO',
      coinId: 'ethereum',
      quantity: '1',
      sats: null,
    };
    expect(() => shiftQuantity(eth, -2n * coin)).toThrow(BadRequestException);
  });
});
