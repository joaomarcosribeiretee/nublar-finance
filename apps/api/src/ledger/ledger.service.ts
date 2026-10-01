import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { InvestmentMovement, Valuation } from './investments';
import type { LedgerEntry } from './ledger';

export type Position = {
  id: string;
  name: string;
  assetClass: 'FIXED_INCOME' | 'STOCK' | 'FII' | 'ETF' | 'CRYPTO' | 'OTHER';
  institutionId: string | null;
  openingApplied: bigint;
  valuations: Valuation[];
  movements: InvestmentMovement[];
};

/** Loads a user's money movements in the shape the pure ledger rules expect. */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async entries(userId: string): Promise<LedgerEntry[]> {
    const rows = await this.prisma.db.transaction.findMany({
      where: { userId, status: { not: 'CANCELED' } },
      select: {
        type: true,
        accountId: true,
        destinationAccountId: true,
        categoryId: true,
        cardId: true,
        invoiceMonth: true,
        status: true,
        recurringRuleId: true,
        installmentCount: true,
        amount: true,
        date: true,
      },
    });

    return rows.map((row) => ({
      type: row.type,
      accountId: row.accountId,
      destinationAccountId: row.destinationAccountId,
      categoryId: row.categoryId,
      cardId: row.cardId,
      invoiceMonth: row.invoiceMonth,
      status: row.status,
      recurring: row.recurringRuleId !== null,
      installmentCount: row.installmentCount,
      amount: row.amount,
      date: row.date.toISOString().slice(0, 10),
    }));
  }

  accounts(userId: string) {
    return this.prisma.db.account.findMany({
      where: { userId },
      orderBy: [
        { institution: { name: 'asc' } },
        { type: 'asc' },
        { name: 'asc' },
      ],
      include: {
        institution: { select: { id: true, name: true, color: true } },
      },
    });
  }

  /** Every investment with what is needed to value it at any date. */
  async positions(userId: string): Promise<Position[]> {
    const investments = await this.prisma.db.investment.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: {
        valuations: {
          orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
          select: { date: true, value: true, createdAt: true },
        },
        transactions: {
          where: {
            status: 'POSTED',
            type: { in: ['INVESTMENT', 'REDEMPTION'] },
          },
          select: { type: true, amount: true, date: true, createdAt: true },
        },
      },
    });
    return investments.map((investment) => ({
      id: investment.id,
      name: investment.name,
      assetClass: investment.assetClass,
      institutionId: investment.institutionId,
      openingApplied: investment.openingApplied,
      valuations: investment.valuations.map((valuation) => ({
        date: valuation.date.toISOString().slice(0, 10),
        value: valuation.value,
        createdAt: valuation.createdAt.toISOString(),
      })),
      movements: investment.transactions.map((movement) => ({
        type: movement.type as InvestmentMovement['type'],
        amount: movement.amount,
        date: movement.date.toISOString().slice(0, 10),
        createdAt: movement.createdAt.toISOString(),
      })),
    }));
  }
}
