import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  bulkValuationSchema,
  createInvestmentSchema,
  investmentMovementSchema,
  updateInvestmentSchema,
  valuationSchema,
} from '@nublar/validation';
import { accountRefSelect, toAccountRef } from '../accounts/account-label';
import { parseBody } from '../common/parse-body';
import { today } from '../common/today';
import { assertInstitution } from '../institutions/assert-institution';
import { dayOf } from '../ledger/cards';
import {
  investmentPerformance,
  investmentValueAt,
} from '../ledger/investments';
import { LedgerService, type Position } from '../ledger/ledger.service';
import { shiftMonth } from '../ledger/month';
import { PrismaService } from '../prisma/prisma.service';

const assetClassNames = {
  FIXED_INCOME: 'Renda fixa',
  STOCK: 'Ações',
  FII: 'FIIs',
  ETF: 'ETFs',
  CRYPTO: 'Cripto',
  OTHER: 'Outros',
} as const;

const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

@Injectable()
export class InvestmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /** Positions with performance, plus portfolio totals and allocation. */
  async list(userId: string) {
    const [positions, details] = await Promise.all([
      this.ledger.positions(userId),
      this.prisma.db.investment.findMany({
        where: { userId },
        include: {
          institution: { select: { id: true, name: true, color: true } },
        },
      }),
    ]);
    const byId = new Map(details.map((detail) => [detail.id, detail]));
    const now = today();

    let current = 0n;
    let applied = 0n;
    let redeemed = 0n;
    const allocation = new Map<Position['assetClass'], bigint>();

    const items = positions.map((position) => {
      const detail = byId.get(position.id)!;
      const performance = investmentPerformance({ ...position, today: now });
      current += performance.current;
      applied += performance.applied;
      redeemed += performance.redeemed;
      allocation.set(
        position.assetClass,
        (allocation.get(position.assetClass) ?? 0n) + performance.current,
      );
      return {
        id: position.id,
        name: position.name,
        assetClass: position.assetClass,
        ticker: detail.ticker,
        quantity: detail.quantity,
        institution: detail.institution,
        startDate: detail.startDate.toISOString().slice(0, 10),
        maturityDate: detail.maturityDate?.toISOString().slice(0, 10) ?? null,
        lastValuation: lastUpdate(position),
        ...fixedIncomeOf(detail),
        ...serializePerformance(performance),
      };
    });

    const gain = current + redeemed - applied;
    return {
      totals: {
        current: current.toString(),
        applied: applied.toString(),
        redeemed: redeemed.toString(),
        gain: gain.toString(),
        gainBps: applied > 0n ? Number((gain * 10000n) / applied) : null,
      },
      allocation: [...allocation.entries()]
        .filter(([, value]) => value > 0n)
        .sort(([, a], [, b]) => (a === b ? 0 : a > b ? -1 : 1))
        .map(([assetClass, value]) => ({
          assetClass,
          name: assetClassNames[assetClass],
          value: value.toString(),
        })),
      items,
      fixedIncome: fixedIncomeSummary(items, now),
    };
  }

  async detail(userId: string, id: string) {
    const investment = await this.find(userId, id);
    const [position] = (await this.ledger.positions(userId)).filter(
      (p) => p.id === id,
    );
    const [valuations, movements] = await Promise.all([
      this.prisma.db.investmentValuation.findMany({
        where: { investmentId: id },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.db.transaction.findMany({
        where: { userId, investmentId: id },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: { account: { select: accountRefSelect } },
      }),
    ]);
    const now = today();

    return {
      id,
      name: investment.name,
      assetClass: investment.assetClass,
      ticker: investment.ticker,
      quantity: investment.quantity,
      institutionId: investment.institutionId,
      startDate: investment.startDate.toISOString().slice(0, 10),
      maturityDate: investment.maturityDate?.toISOString().slice(0, 10) ?? null,
      ...fixedIncomeOf(investment),
      ...serializePerformance(
        investmentPerformance({ ...position, today: now }),
      ),
      history: monthEndHistory(position, investment.startDate, now),
      valuations: valuations.map((valuation) => ({
        id: valuation.id,
        date: valuation.date.toISOString().slice(0, 10),
        value: valuation.value.toString(),
      })),
      movements: movements.map((movement) => ({
        id: movement.id,
        type: movement.type,
        amount: movement.amount.toString(),
        date: movement.date.toISOString().slice(0, 10),
        account: toAccountRef(movement.account),
      })),
    };
  }

  async create(userId: string, body: unknown) {
    const input = parseBody(createInvestmentSchema, body);
    await assertInstitution(this.prisma, userId, input.institutionId);
    const now = today();
    const startDate = input.startDate ?? now;
    if (startDate > now) {
      throw new BadRequestException('A data de início não pode ser no futuro');
    }
    // Simple mode: only today's value is known. Like an account's opening
    // balance, it counts from the start of tracking, and gains are measured
    // from here on (applied = value).
    const simple = input.openingApplied === undefined;
    const opening = input.openingApplied ?? input.currentValue;
    const since = simple ? await this.trackingStart(userId, now) : startDate;

    const investment = await this.prisma.db.$transaction(async (tx) => {
      const created = await tx.investment.create({
        data: {
          userId,
          institutionId: input.institutionId ?? null,
          name: input.name,
          assetClass: input.assetClass,
          ticker: input.ticker ?? '',
          quantity: input.quantity ?? '',
          openingApplied: opening,
          startDate: asDate(since),
          maturityDate: input.maturityDate ? asDate(input.maturityDate) : null,
          product: fixed(input.assetClass, input.product),
          indexer: fixed(input.assetClass, input.indexer),
          rateBps: fixed(input.assetClass, input.rateBps),
          liquidity: fixed(input.assetClass, input.liquidity),
        },
      });
      // What was applied on the start date, then what it is worth today:
      // the history between them is a straight step, not invented returns.
      const valuations = simple
        ? [{ date: since, value: input.currentValue }]
        : since < now && opening > 0n
          ? [
              { date: since, value: opening },
              { date: now, value: input.currentValue },
            ]
          : [{ date: now, value: input.currentValue }];
      await tx.investmentValuation.createMany({
        data: valuations.map((valuation) => ({
          userId,
          investmentId: created.id,
          date: asDate(valuation.date),
          value: valuation.value,
        })),
      });
      return created;
    });
    return { id: investment.id };
  }

  async update(userId: string, id: string, body: unknown) {
    const input = parseBody(updateInvestmentSchema, body);
    await this.find(userId, id);
    await assertInstitution(this.prisma, userId, input.institutionId);
    await this.prisma.db.investment.update({
      where: { id },
      data: {
        name: input.name,
        assetClass: input.assetClass,
        institutionId: input.institutionId ?? null,
        ticker: input.ticker ?? '',
        quantity: input.quantity ?? '',
        maturityDate: input.maturityDate ? asDate(input.maturityDate) : null,
        product: fixed(input.assetClass, input.product),
        indexer: fixed(input.assetClass, input.indexer),
        rateBps: fixed(input.assetClass, input.rateBps),
        liquidity: fixed(input.assetClass, input.liquidity),
      },
    });
    return { id };
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.find(userId, id);
    const moves = await this.prisma.db.transaction.count({
      where: { userId, investmentId: id },
    });
    if (moves > 0) {
      throw new ConflictException(
        'Este investimento tem aportes ou resgates. Exclua-os antes.',
      );
    }
    await this.prisma.db.investment.delete({ where: { id } });
  }

  async move(userId: string, id: string, body: unknown) {
    const input = parseBody(investmentMovementSchema, body);
    const investment = await this.find(userId, id);
    const account = await this.prisma.db.account.findFirst({
      where: { id: input.accountId, userId },
      select: { id: true },
    });
    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }
    if (input.type === 'REDEMPTION') {
      const [position] = (await this.ledger.positions(userId)).filter(
        (p) => p.id === id,
      );
      const value = investmentValueAt(
        position.valuations,
        position.movements,
        input.date,
      );
      if (input.amount > value) {
        throw new BadRequestException(
          'O resgate é maior que o valor do investimento nessa data',
        );
      }
    }
    const movement = await this.prisma.db.transaction.create({
      data: {
        userId,
        type: input.type,
        accountId: input.accountId,
        investmentId: id,
        amount: input.amount,
        description: `${input.type === 'INVESTMENT' ? 'Aporte' : 'Resgate'} · ${investment.name}`,
        date: asDate(input.date),
        source: 'MANUAL',
        status: 'POSTED',
      },
    });
    return { id: movement.id };
  }

  /** Today's value of several positions at once (monthly check-in). */
  async addValuations(userId: string, body: unknown) {
    const input = parseBody(bulkValuationSchema, body);
    if (input.date > today()) {
      throw new BadRequestException('A data não pode ser no futuro');
    }
    const ids = [...new Set(input.items.map((item) => item.investmentId))];
    const owned = await this.prisma.db.investment.count({
      where: { userId, id: { in: ids } },
    });
    if (owned !== ids.length) {
      throw new NotFoundException('Investimento não encontrado');
    }
    await this.prisma.db.investmentValuation.createMany({
      data: input.items.map((item) => ({
        userId,
        investmentId: item.investmentId,
        date: asDate(input.date),
        value: item.value,
      })),
    });
    return { updated: input.items.length };
  }

  /** First day the user has anything recorded, or today. */
  private async trackingStart(userId: string, now: string): Promise<string> {
    const first = await this.prisma.db.transaction.findFirst({
      where: { userId },
      orderBy: { date: 'asc' },
      select: { date: true },
    });
    const date = first?.date.toISOString().slice(0, 10);
    return date && date < now ? date : now;
  }

  async addValuation(userId: string, id: string, body: unknown) {
    const input = parseBody(valuationSchema, body);
    await this.find(userId, id);
    if (input.date > today()) {
      throw new BadRequestException('A data não pode ser no futuro');
    }
    const valuation = await this.prisma.db.investmentValuation.create({
      data: {
        userId,
        investmentId: id,
        date: asDate(input.date),
        value: input.value,
      },
    });
    return { id: valuation.id };
  }

  async removeValuation(userId: string, id: string, valuationId: string) {
    await this.find(userId, id);
    const count = await this.prisma.db.investmentValuation.count({
      where: { investmentId: id },
    });
    if (count <= 1) {
      throw new BadRequestException(
        'O investimento precisa de ao menos um valor',
      );
    }
    const deleted = await this.prisma.db.investmentValuation.deleteMany({
      where: { id: valuationId, investmentId: id, userId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Valor não encontrado');
    }
  }

  private async find(userId: string, id: string) {
    const investment = await this.prisma.db.investment.findFirst({
      where: { id, userId },
    });
    if (!investment) {
      throw new NotFoundException('Investimento não encontrado');
    }
    return investment;
  }
}

function serializePerformance(
  performance: ReturnType<typeof investmentPerformance>,
) {
  return {
    current: performance.current.toString(),
    applied: performance.applied.toString(),
    redeemed: performance.redeemed.toString(),
    gain: performance.gain.toString(),
    gainBps: performance.gainBps,
  };
}

/** Value at the end of each month since the start (at most 36 points). */
function monthEndHistory(position: Position, start: Date, now: string) {
  const last = now.slice(0, 7);
  let month = start.toISOString().slice(0, 7);
  if (month < shiftMonth(last, -35)) {
    month = shiftMonth(last, -35);
  }
  const points: { month: string; value: string }[] = [];
  for (; month <= last; month = shiftMonth(month, 1)) {
    const date = month === last ? now : dayOf(month, 31);
    points.push({
      month,
      value: investmentValueAt(
        position.valuations,
        position.movements,
        date,
      ).toString(),
    });
  }
  return points;
}

type FixedIncomeFields = {
  product: string | null;
  indexer: string | null;
  rateBps: number | null;
  liquidity: string | null;
};

function fixedIncomeOf(investment: FixedIncomeFields) {
  return {
    product: investment.product,
    indexer: investment.indexer,
    rateBps: investment.rateBps,
    liquidity: investment.liquidity,
  };
}

/** Fixed-income details only make sense on fixed-income positions. */
function fixed<T>(assetClass: string, value: T | null | undefined): T | null {
  return assetClass === 'FIXED_INCOME' ? (value ?? null) : null;
}

/**
 * How much fixed income can be withdrawn any day versus only at maturity,
 * and what matures in the next twelve months.
 */
export function fixedIncomeSummary(
  items: {
    id: string;
    name: string;
    assetClass: string;
    current: string;
    liquidity: string | null;
    maturityDate: string | null;
  }[],
  now: string,
) {
  let daily = 0n;
  let atMaturity = 0n;
  let unknown = 0n;
  const limit = `${Number(now.slice(0, 4)) + 1}${now.slice(4)}`;
  const maturities: {
    id: string;
    name: string;
    date: string;
    value: string;
  }[] = [];
  for (const item of items) {
    if (item.assetClass !== 'FIXED_INCOME') continue;
    const value = BigInt(item.current);
    if (item.liquidity === 'DAILY') daily += value;
    else if (item.liquidity === 'AT_MATURITY') atMaturity += value;
    else unknown += value;
    if (
      item.maturityDate &&
      item.maturityDate >= now &&
      item.maturityDate <= limit
    ) {
      maturities.push({
        id: item.id,
        name: item.name,
        date: item.maturityDate,
        value: item.current,
      });
    }
  }
  maturities.sort((a, b) => a.date.localeCompare(b.date));
  return {
    daily: daily.toString(),
    atMaturity: atMaturity.toString(),
    unknown: unknown.toString(),
    maturities,
  };
}

/**
 * When the user last told us the value. Not the valuation date: a simple-mode
 * value is dated at the start of tracking but was typed in today.
 */
function lastUpdate(position: Position): string | null {
  let latest: string | null = null;
  for (const valuation of position.valuations) {
    if (valuation.createdAt && (!latest || valuation.createdAt > latest)) {
      latest = valuation.createdAt;
    }
  }
  return latest ? today(new Date(latest)) : null;
}
