import { costBasis, type QuantityMovement } from './cost-basis';

const coin = 10n ** 18n;
const reais = (value: number) => BigInt(value) * 100n;
const buy = (
  amount: number,
  units: bigint,
  date: string,
): QuantityMovement => ({
  type: 'INVESTMENT',
  amount: reais(amount),
  units,
  date,
});
const sell = (
  amount: number,
  units: bigint,
  date: string,
): QuantityMovement => ({
  type: 'REDEMPTION',
  amount: reais(amount),
  units,
  date,
});

describe('costBasis', () => {
  it('weights the average by what each purchase paid', () => {
    const result = costBasis({
      openingApplied: 0n,
      heldUnits: 2n * coin,
      current: reais(360_000),
      movements: [
        buy(100_000, coin, '2026-01-10'),
        buy(200_000, coin, '2026-02-10'),
      ],
      today: '2026-03-01',
    });
    expect(result).toMatchObject({
      averagePrice: reais(150_000),
      quantity: '2',
      costBasis: reais(300_000),
      unrealized: reais(60_000),
      unrealizedBps: 2000,
      realized: 0n,
      hasSales: false,
    });
  });

  it('keeps the average on a partial sale and realizes the difference', () => {
    const result = costBasis({
      openingApplied: 0n,
      heldUnits: (3n * coin) / 2n,
      current: reais(270_000),
      movements: [
        buy(100_000, coin, '2026-01-10'),
        buy(200_000, coin, '2026-02-10'),
        sell(100_000, coin / 2n, '2026-03-10'),
      ],
      today: '2026-04-01',
    });
    expect(result).toMatchObject({
      averagePrice: reais(150_000),
      quantity: '1.5',
      costBasis: reais(225_000),
      unrealized: reais(45_000),
      unrealizedBps: 2000,
      realized: reais(25_000),
      realizedBps: 3333,
      hasSales: true,
    });
  });

  it('counts the opening lot as the quantity the movements do not explain', () => {
    // Registered with 1 BTC that cost R$ 100.000, then bought 1 more.
    const result = costBasis({
      openingApplied: reais(100_000),
      heldUnits: 2n * coin,
      current: reais(400_000),
      movements: [buy(300_000, coin, '2026-02-10')],
      today: '2026-03-01',
    });
    expect(result?.averagePrice).toBe(reais(200_000));
    expect(result?.unrealized).toBe(0n);
  });

  it('realizes a loss and zeroes the cost when everything is sold', () => {
    const result = costBasis({
      openingApplied: 0n,
      heldUnits: 0n,
      current: 0n,
      movements: [
        buy(300, 3n * coin, '2026-01-10'),
        sell(250, 3n * coin, '2026-02-10'),
      ],
      today: '2026-03-01',
    });
    expect(result).toMatchObject({
      averagePrice: null,
      quantity: '0',
      costBasis: 0n,
      realized: reais(-50),
      realizedBps: -1666,
    });
  });

  it('sorts by date, so a sale typed late still uses the price of its day', () => {
    const result = costBasis({
      openingApplied: 0n,
      heldUnits: coin,
      current: reais(200),
      movements: [
        buy(400, coin, '2026-03-01'),
        sell(150, coin, '2026-02-01'),
        buy(100, coin, '2026-01-01'),
      ],
      today: '2026-04-01',
    });
    expect(result?.realized).toBe(reais(50));
    expect(result?.averagePrice).toBe(reais(400));
  });

  it('rounds the average price half up, in centavos', () => {
    // R$ 100 for 3 coins: 33,333… → R$ 33,33.
    const result = costBasis({
      openingApplied: 0n,
      heldUnits: 3n * coin,
      current: reais(100),
      movements: [buy(100, 3n * coin, '2026-01-10')],
      today: '2026-03-01',
    });
    expect(result?.averagePrice).toBe(3333n);
  });

  it('cannot tell the price without quantities', () => {
    const base = { openingApplied: 0n, current: 0n, today: '2026-03-01' };
    const noUnits = { ...buy(100, coin, '2026-01-10'), units: null };
    expect(costBasis({ ...base, heldUnits: null, movements: [] })).toBeNull();
    expect(
      costBasis({ ...base, heldUnits: coin, movements: [noUnits] }),
    ).toBeNull();
    // Sold before it was bought: more sold than held on that day.
    expect(
      costBasis({
        ...base,
        heldUnits: 0n,
        movements: [
          sell(100, coin, '2026-01-10'),
          buy(100, coin, '2026-02-10'),
        ],
      }),
    ).toBeNull();
    // Money applied before tracking, but no coins left for it.
    expect(
      costBasis({
        ...base,
        openingApplied: reais(100),
        heldUnits: coin,
        movements: [buy(100, coin, '2026-01-10')],
      }),
    ).toBeNull();
  });

  it('leaves future-dated movements out', () => {
    const result = costBasis({
      openingApplied: 0n,
      heldUnits: 2n * coin,
      current: reais(100),
      movements: [buy(100, coin, '2026-01-10'), buy(900, coin, '2026-12-10')],
      today: '2026-03-01',
    });
    // The future coin is already in the quantity, but not in today's result.
    expect(result).toMatchObject({ averagePrice: reais(100), quantity: '1' });
  });
});
