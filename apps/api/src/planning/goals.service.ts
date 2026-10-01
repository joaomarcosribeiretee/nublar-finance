import { Injectable, NotFoundException } from '@nestjs/common';
import { goalSchema, type GoalInput } from '@nublar/validation';
import { parseBody } from '../common/parse-body';
import { today } from '../common/today';
import { investmentValueAt } from '../ledger/investments';
import { balanceOf } from '../ledger/ledger';
import { LedgerService } from '../ledger/ledger.service';
import { goalPlan } from '../ledger/planning';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /** Saved = manual amount + linked accounts' balances + linked investments' value. */
  async list(userId: string) {
    const [goals, entries, accounts, positions] = await Promise.all([
      this.prisma.db.goal.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        include: { links: true },
      }),
      this.ledger.entries(userId),
      this.ledger.accounts(userId),
      this.ledger.positions(userId),
    ]);
    const now = today();
    const accountValue = new Map(
      accounts.map((a) => [a.id, a.openingBalance + balanceOf(a.id, entries)]),
    );
    const investmentValue = new Map(
      positions.map((p) => [
        p.id,
        investmentValueAt(p.valuations, p.movements, now),
      ]),
    );

    return goals.map((goal) => {
      let saved = goal.manualSaved;
      for (const link of goal.links) {
        if (link.accountId) saved += accountValue.get(link.accountId) ?? 0n;
        if (link.investmentId)
          saved += investmentValue.get(link.investmentId) ?? 0n;
      }
      const targetDate = goal.targetDate?.toISOString().slice(0, 10) ?? null;
      const plan = goalPlan({
        target: goal.target,
        saved,
        targetDate,
        today: now,
      });
      return {
        id: goal.id,
        name: goal.name,
        color: goal.color,
        target: goal.target.toString(),
        targetDate,
        manualSaved: goal.manualSaved.toString(),
        accountIds: goal.links.flatMap((l) =>
          l.accountId ? [l.accountId] : [],
        ),
        investmentIds: goal.links.flatMap((l) =>
          l.investmentId ? [l.investmentId] : [],
        ),
        saved: saved.toString(),
        remaining: plan.remaining.toString(),
        progressBps: plan.progressBps,
        monthsLeft: plan.monthsLeft,
        monthlyNeeded: plan.monthlyNeeded?.toString() ?? null,
        reached: plan.reached,
        late: plan.late,
      };
    });
  }

  async create(userId: string, body: unknown) {
    const input = parseBody(goalSchema, body);
    await this.assertLinks(userId, input);
    const goal = await this.prisma.db.goal.create({
      data: {
        userId,
        ...toData(input),
        links: { create: linksOf(input) },
      },
    });
    return { id: goal.id };
  }

  async update(userId: string, id: string, body: unknown) {
    const input = parseBody(goalSchema, body);
    await this.find(userId, id);
    await this.assertLinks(userId, input);
    await this.prisma.db.$transaction([
      this.prisma.db.goalLink.deleteMany({ where: { goalId: id } }),
      this.prisma.db.goal.update({
        where: { id },
        data: { ...toData(input), links: { create: linksOf(input) } },
      }),
    ]);
    return { id };
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.find(userId, id);
    await this.prisma.db.goal.delete({ where: { id } });
  }

  private async find(userId: string, id: string) {
    const goal = await this.prisma.db.goal.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!goal) {
      throw new NotFoundException('Meta não encontrada');
    }
    return goal;
  }

  /** Never trust ids from the client: every link must be the user's own. */
  private async assertLinks(userId: string, input: GoalInput) {
    const accountIds = [...new Set(input.accountIds ?? [])];
    const investmentIds = [...new Set(input.investmentIds ?? [])];
    const [accounts, investments] = await Promise.all([
      this.prisma.db.account.count({
        where: { userId, id: { in: accountIds } },
      }),
      this.prisma.db.investment.count({
        where: { userId, id: { in: investmentIds } },
      }),
    ]);
    if (
      accounts !== accountIds.length ||
      investments !== investmentIds.length
    ) {
      throw new NotFoundException('Conta ou investimento não encontrado');
    }
  }
}

function toData(input: GoalInput) {
  return {
    name: input.name,
    target: input.target,
    targetDate: input.targetDate
      ? new Date(`${input.targetDate}T00:00:00.000Z`)
      : null,
    manualSaved: input.manualSaved ?? 0n,
    color: input.color,
  };
}

function linksOf(input: GoalInput) {
  return [
    ...[...new Set(input.accountIds ?? [])].map((accountId) => ({ accountId })),
    ...[...new Set(input.investmentIds ?? [])].map((investmentId) => ({
      investmentId,
    })),
  ];
}
