import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { budgetSchema, calendarMonthSchema } from '@nublar/validation';
import { parseBody } from '../common/parse-body';
import { competenceMonth } from '../ledger/ledger';
import { LedgerService } from '../ledger/ledger.service';
import { budgetStatus } from '../ledger/planning';
import { PrismaService } from '../prisma/prisma.service';
import { RecurringService } from '../recurring/recurring.service';

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly recurring: RecurringService,
  ) {}

  /**
   * Each budget against what was spent in the month (by competence, so card
   * purchases count in their invoice month) and what is still scheduled.
   */
  async list(userId: string, rawMonth: string) {
    if (!calendarMonthSchema.safeParse(rawMonth).success) {
      throw new BadRequestException('Mês deve usar AAAA-MM');
    }
    const month = rawMonth;
    await this.recurring.materialize(userId, month);
    const [budgets, entries] = await Promise.all([
      this.prisma.db.budget.findMany({
        where: { userId },
        include: { category: { select: { id: true, name: true } } },
        orderBy: { category: { name: 'asc' } },
      }),
      this.ledger.entries(userId),
    ]);

    const spent = new Map<string, bigint>();
    const scheduled = new Map<string, bigint>();
    let unbudgeted = 0n;
    const budgeted = new Set(budgets.map((b) => b.categoryId));
    for (const entry of entries) {
      if (entry.type !== 'EXPENSE' || competenceMonth(entry) !== month)
        continue;
      const key = entry.categoryId ?? '';
      const target = entry.status === 'PENDING' ? scheduled : spent;
      target.set(key, (target.get(key) ?? 0n) + entry.amount);
      if (entry.status !== 'PENDING' && !budgeted.has(key)) {
        unbudgeted += entry.amount;
      }
    }

    let totalLimit = 0n;
    let totalSpent = 0n;
    const items = budgets.map((budget) => {
      const used = spent.get(budget.categoryId) ?? 0n;
      totalLimit += budget.amount;
      totalSpent += used;
      const status = budgetStatus(used, budget.amount);
      return {
        id: budget.id,
        category: budget.category,
        limit: budget.amount.toString(),
        spent: used.toString(),
        scheduled: (scheduled.get(budget.categoryId) ?? 0n).toString(),
        remaining: status.remaining.toString(),
        usedBps: status.usedBps,
        status: status.status,
      };
    });
    const total = budgetStatus(totalSpent, totalLimit);

    return {
      month,
      totals: {
        limit: totalLimit.toString(),
        spent: totalSpent.toString(),
        remaining: total.remaining.toString(),
        usedBps: total.usedBps,
        status: total.status,
        unbudgeted: unbudgeted.toString(),
      },
      items: items.sort((a, b) => b.usedBps - a.usedBps),
    };
  }

  /** One budget per category: setting it again replaces the amount. */
  async upsert(userId: string, body: unknown) {
    const input = parseBody(budgetSchema, body);
    const category = await this.prisma.db.category.findFirst({
      where: { id: input.categoryId, userId },
      select: { kind: true },
    });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }
    if (category.kind !== 'EXPENSE') {
      throw new BadRequestException(
        'Orçamento é só para categorias de despesa',
      );
    }
    const budget = await this.prisma.db.budget.upsert({
      where: { categoryId: input.categoryId },
      create: { userId, categoryId: input.categoryId, amount: input.amount },
      update: { amount: input.amount },
    });
    return { id: budget.id };
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.prisma.db.budget.deleteMany({
      where: { id, userId },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Orçamento não encontrado');
    }
  }
}
