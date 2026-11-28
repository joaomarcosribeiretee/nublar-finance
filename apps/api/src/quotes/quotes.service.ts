import { Injectable, Logger } from '@nestjs/common';
import { cryptoCoins } from '@nublar/validation';
import { today } from '../common/today';
import { parseSimplePrice } from '../ledger/quotes';
import { PrismaService } from '../prisma/prisma.service';

export type Quote = {
  /** BRL price as decimal text. */
  price: string;
  fetchedAt: Date;
};

export type QuoteBoard = {
  quotes: Map<string, Quote>;
  /** The last attempt failed: these are the last known prices. */
  stale: boolean;
};

/** Fresh enough for a balance that changes all day; also spares the free API. */
export const QUOTE_TTL_MS = 5 * 60_000;
/** The refresh button can skip the cache, but not hammer the source. */
export const FORCED_REFRESH_MS = 60_000;

const SOURCE = 'https://api.coingecko.com/api/v3/simple/price';
const coinIds = cryptoCoins.map((coin) => coin.id);

/**
 * BRL quotes of the supported coins, from CoinGecko's public endpoint (no
 * key). Cached in memory; every success is also the day's snapshot in the
 * database, which is where the last known price comes from after a restart.
 */
@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);
  private cache = new Map<string, Quote>();
  private lastAttempt = 0;
  private stale = false;
  private pending: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async board({ force = false } = {}): Promise<QuoteBoard> {
    const age = Date.now() - this.lastAttempt;
    if (age >= (force ? FORCED_REFRESH_MS : QUOTE_TTL_MS)) {
      // Several screens open at once share one request.
      this.pending ??= this.refresh().finally(() => {
        this.pending = null;
      });
      await this.pending;
    }
    return { quotes: new Map(this.cache), stale: this.stale };
  }

  private async refresh(): Promise<void> {
    this.lastAttempt = Date.now();
    try {
      const prices = await this.fetchPrices();
      if (prices.size === 0) {
        throw new Error('no prices in the answer');
      }
      const fetchedAt = new Date();
      for (const [coinId, price] of prices) {
        this.cache.set(coinId, { price, fetchedAt });
      }
      this.stale = prices.size < coinIds.length;
      await this.snapshot(prices, fetchedAt);
    } catch (error) {
      this.stale = true;
      this.logger.warn(`Quote source failed: ${String(error)}`);
      if (this.cache.size === 0) {
        await this.loadLastKnown();
      }
    }
  }

  protected async fetchPrices(): Promise<Map<string, string>> {
    const url = `${SOURCE}?ids=${coinIds.join(',')}&vs_currencies=brl`;
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return parseSimplePrice(await response.json(), coinIds);
  }

  /** The day's quote, replaced by each refresh: the last one of the day stays. */
  private async snapshot(prices: Map<string, string>, fetchedAt: Date) {
    const date = new Date(`${today(fetchedAt)}T00:00:00.000Z`);
    try {
      await this.prisma.db.$transaction(
        [...prices].map(([coinId, price]) =>
          this.prisma.db.cryptoQuote.upsert({
            where: { coinId_date: { coinId, date } },
            create: { coinId, date, price, fetchedAt },
            update: { price, fetchedAt },
          }),
        ),
      );
    } catch (error) {
      this.logger.warn(`Could not save quote snapshot: ${String(error)}`);
    }
  }

  private async loadLastKnown() {
    try {
      const rows = await this.prisma.db.cryptoQuote.findMany({
        where: { coinId: { in: coinIds } },
        orderBy: { fetchedAt: 'desc' },
        distinct: ['coinId'],
      });
      for (const row of rows) {
        this.cache.set(row.coinId, {
          price: row.price,
          fetchedAt: row.fetchedAt,
        });
      }
    } catch (error) {
      this.logger.warn(`Could not load last quotes: ${String(error)}`);
    }
  }
}
