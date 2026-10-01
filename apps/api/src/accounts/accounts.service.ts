import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createAccountSchema, updateAccountSchema } from '@nublar/validation';
import { assertInstitution } from '../institutions/assert-institution';
import { parseBody } from '../common/parse-body';
import { accountLabel } from './account-label';
import { balanceOf } from '../ledger/ledger';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async list(userId: string) {
    const [accounts, entries] = await Promise.all([
      this.ledger.accounts(userId),
      this.ledger.entries(userId),
    ]);

    return accounts.map((account) => ({
      id: account.id,
      name: account.name,
      label: accountLabel(account),
      type: account.type,
      currency: account.currency,
      institution: account.institution,
      openingBalance: account.openingBalance.toString(),
      balance: (
        account.openingBalance + balanceOf(account.id, entries)
      ).toString(),
    }));
  }

  async create(userId: string, body: unknown) {
    const input = parseBody(createAccountSchema, body);
    await assertInstitution(this.prisma, userId, input.institutionId);
    const account = await this.prisma.db.account.create({
      data: {
        userId,
        institutionId: input.institutionId ?? null,
        name: input.name ?? '',
        type: input.type,
        openingBalance: input.openingBalance ?? 0n,
      },
    });
    return { id: account.id };
  }

  async update(userId: string, id: string, body: unknown) {
    const input = parseBody(updateAccountSchema, body);
    await assertInstitution(this.prisma, userId, input.institutionId);
    const updated = await this.prisma.db.account.updateMany({
      where: { id, userId },
      data: {
        name: input.name,
        institutionId: input.institutionId,
        openingBalance: input.openingBalance,
      },
    });
    if (updated.count === 0) {
      throw new NotFoundException('Conta não encontrada');
    }
    return { id };
  }

  async remove(userId: string, id: string): Promise<void> {
    const account = await this.prisma.db.account.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }

    // Deleting an account with history would silently change past balances
    // and net worth, so the user has to move or delete its entries first.
    const [used, rules] = await Promise.all([
      this.prisma.db.transaction.count({
        where: {
          userId,
          status: { not: 'CANCELED' },
          OR: [{ accountId: id }, { destinationAccountId: id }],
        },
      }),
      this.prisma.db.recurringRule.count({ where: { userId, accountId: id } }),
    ]);
    if (used > 0) {
      throw new ConflictException(
        'Esta conta tem lançamentos. Exclua-os antes de remover a conta.',
      );
    }
    if (rules > 0) {
      throw new ConflictException(
        'Esta conta é usada por uma recorrência. Remova-a antes.',
      );
    }

    await this.prisma.db.$transaction([
      this.prisma.db.transaction.deleteMany({
        where: { userId, accountId: id, status: 'CANCELED' },
      }),
      this.prisma.db.account.delete({ where: { id } }),
    ]);
  }
}
