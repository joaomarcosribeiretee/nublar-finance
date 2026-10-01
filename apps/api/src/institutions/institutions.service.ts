import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { institutionSchema } from '@nublar/validation';
import { parseBody } from '../common/parse-body';
import { isUniqueViolation } from '../common/prisma-errors';
import { today } from '../common/today';
import { positionsValueAt } from '../ledger/investments';
import { balanceOf, cardDebt } from '../ledger/ledger';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InstitutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /** Each institution with what its accounts hold and what its cards owe. */
  async list(userId: string) {
    const [institutions, entries, positions] = await Promise.all([
      this.prisma.db.institution.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
        include: {
          accounts: { select: { id: true, openingBalance: true } },
          cards: { select: { id: true } },
        },
      }),
      this.ledger.entries(userId),
      this.ledger.positions(userId),
    ]);
    const now = today();

    return institutions.map((institution) => {
      let cash = 0n;
      for (const account of institution.accounts) {
        cash += account.openingBalance + balanceOf(account.id, entries);
      }
      const invested = positionsValueAt(
        positions.filter((p) => p.institutionId === institution.id),
        now,
      );
      let debt = 0n;
      for (const card of institution.cards) {
        debt += cardDebt(card.id, entries);
      }
      return {
        id: institution.id,
        name: institution.name,
        color: institution.color,
        cash: cash.toString(),
        investments: invested.toString(),
        /** What the user holds there: accounts plus investments. */
        total: (cash + invested).toString(),
        cardDebt: debt.toString(),
      };
    });
  }

  async create(userId: string, body: unknown) {
    const input = parseBody(institutionSchema, body);
    try {
      const institution = await this.prisma.db.institution.create({
        data: { userId, name: input.name, color: input.color },
      });
      return {
        id: institution.id,
        name: institution.name,
        color: institution.color,
      };
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Você já cadastrou essa instituição');
      }
      throw error;
    }
  }

  async update(userId: string, id: string, body: unknown) {
    const input = parseBody(institutionSchema, body);
    await this.find(userId, id);
    try {
      await this.prisma.db.institution.update({
        where: { id },
        data: { name: input.name, color: input.color },
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Já existe uma instituição com esse nome');
      }
      throw error;
    }
    return { id };
  }

  async remove(userId: string, id: string): Promise<void> {
    const institution = await this.find(userId, id);
    if (institution._count.accounts > 0 || institution._count.cards > 0) {
      throw new ConflictException(
        'Remova as contas e cartões desta instituição antes de excluí-la.',
      );
    }
    await this.prisma.db.institution.delete({ where: { id } });
  }

  private async find(userId: string, id: string) {
    const institution = await this.prisma.db.institution.findFirst({
      where: { id, userId },
      include: { _count: { select: { accounts: true, cards: true } } },
    });
    if (!institution) {
      throw new NotFoundException('Instituição não encontrada');
    }
    return institution;
  }
}
