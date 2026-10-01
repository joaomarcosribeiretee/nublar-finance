import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  const userId = '6d8f4a2e-1c3b-4e5a-9f70-1a2b3c4d5e6f';
  const accountId = '7e9f5b3f-2d4c-4f6b-8a81-2b3c4d5e6f70';
  const entryId = '9a1b7d51-4f6e-418d-8ca3-4d5e6f708192';

  function serviceWith(db: Record<string, unknown>) {
    return new TransactionsService(
      { db } as never,
      {} as never,
      { materialize: jest.fn() } as never,
    );
  }

  it('does not accept an account that is not owned by the user', async () => {
    const db = {
      account: { findFirst: jest.fn().mockResolvedValue(null) },
      category: { findFirst: jest.fn() },
      transaction: { create: jest.fn() },
    };

    await expect(
      serviceWith(db).create(userId, {
        type: 'EXPENSE',
        accountId,
        categoryId: '8f0a6c40-3e5d-407c-9b92-3c4d5e6f7081',
        amount: '1000',
        date: '2026-09-30',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.transaction.create).not.toHaveBeenCalled();
  });

  it('does not edit an entry that belongs to another user', async () => {
    const db = {
      transaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };

    await expect(
      serviceWith(db).update(userId, entryId, {
        type: 'EXPENSE',
        accountId,
        categoryId: '8f0a6c40-3e5d-407c-9b92-3c4d5e6f7081',
        amount: '1000',
        date: '2026-09-30',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.transaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: entryId, userId } }),
    );
    expect(db.transaction.update).not.toHaveBeenCalled();
  });

  it('scopes deletion to the signed-in user', async () => {
    const db = {
      transaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        delete: jest.fn(),
      },
    };

    await expect(
      serviceWith(db).remove(userId, entryId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.transaction.delete).not.toHaveBeenCalled();
  });

  it('skips a pending recurring occurrence instead of deleting it', async () => {
    const db = {
      transaction: {
        findFirst: jest.fn().mockResolvedValue({
          id: entryId,
          type: 'EXPENSE',
          status: 'PENDING',
          purchaseId: null,
          recurringRuleId: 'rule',
        }),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    await serviceWith(db).remove(userId, entryId);

    expect(db.transaction.update).toHaveBeenCalledWith({
      where: { id: entryId },
      data: { status: 'CANCELED' },
    });
    expect(db.transaction.delete).not.toHaveBeenCalled();
  });

  it('refuses to delete a single installment of a card purchase', async () => {
    const db = {
      transaction: {
        findFirst: jest.fn().mockResolvedValue({
          id: entryId,
          type: 'EXPENSE',
          status: 'POSTED',
          purchaseId: 'purchase',
          recurringRuleId: null,
        }),
        delete: jest.fn(),
      },
    };

    await expect(
      serviceWith(db).remove(userId, entryId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.transaction.delete).not.toHaveBeenCalled();
  });

  it('only confirms entries that are still pending', async () => {
    const db = {
      transaction: {
        findFirst: jest.fn().mockResolvedValue({
          id: entryId,
          type: 'EXPENSE',
          status: 'POSTED',
          purchaseId: null,
          recurringRuleId: 'rule',
        }),
        update: jest.fn(),
      },
    };

    await expect(
      serviceWith(db).confirm(userId, entryId, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.transaction.update).not.toHaveBeenCalled();
  });
});
