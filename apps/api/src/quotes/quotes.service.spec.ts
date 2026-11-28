import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { QUOTE_TTL_MS, QuotesService } from './quotes.service';

/** The source is replaced by a queue of answers (a Map) or failures. */
class FakeQuotes extends QuotesService {
  answers: (Map<string, string> | Error)[] = [];
  calls = 0;

  protected fetchPrices(): Promise<Map<string, string>> {
    this.calls += 1;
    const next = this.answers.shift() ?? new Error('no answer');
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }
}

function setup(saved: { coinId: string; price: string; fetchedAt: Date }[]) {
  const upsert = jest.fn((args: unknown) => args);
  const prisma = {
    db: {
      $transaction: jest.fn((ops: unknown[]) => Promise.resolve(ops)),
      cryptoQuote: {
        upsert,
        findMany: jest.fn(() => Promise.resolve(saved)),
      },
    },
  } as unknown as PrismaService;
  return { quotes: new FakeQuotes(prisma), upsert };
}

const all = new Map([
  ['bitcoin', '512345.12'],
  ['ethereum', '18000'],
  ['solana', '900.5'],
  ['tether', '5.4'],
  ['usd-coin', '5.41'],
]);

describe('QuotesService', () => {
  let now = 1_000_000;
  beforeEach(() => {
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('asks the source once per five minutes and snapshots the day', async () => {
    const { quotes, upsert } = setup([]);
    quotes.answers = [all, all];

    const first = await quotes.board();
    expect(first.stale).toBe(false);
    expect(first.quotes.get('bitcoin')?.price).toBe('512345.12');
    expect(upsert).toHaveBeenCalledTimes(5);

    now += QUOTE_TTL_MS - 1;
    await quotes.board();
    expect(quotes.calls).toBe(1);

    now += 1;
    await quotes.board();
    expect(quotes.calls).toBe(2);
  });

  it('keeps the last price when the source fails, flagged as stale', async () => {
    const { quotes } = setup([]);
    quotes.answers = [all, new Error('timeout')];
    await quotes.board();

    now += QUOTE_TTL_MS;
    const board = await quotes.board();
    expect(board.stale).toBe(true);
    expect(board.quotes.get('bitcoin')?.price).toBe('512345.12');
  });

  it('falls back to the saved snapshot after a restart', async () => {
    const fetchedAt = new Date('2026-11-26T15:00:00.000Z');
    const { quotes } = setup([
      { coinId: 'bitcoin', price: '500000', fetchedAt },
    ]);
    quotes.answers = [new Error('down')];

    const board = await quotes.board();
    expect(board.stale).toBe(true);
    expect(board.quotes.get('bitcoin')).toEqual({ price: '500000', fetchedAt });
  });

  it('lets the refresh button skip the cache, but at most once a minute', async () => {
    const { quotes } = setup([]);
    quotes.answers = [all, all];
    await quotes.board();

    now += 30_000;
    await quotes.board({ force: true });
    expect(quotes.calls).toBe(1);

    now += 30_000;
    await quotes.board({ force: true });
    expect(quotes.calls).toBe(2);
  });
});
