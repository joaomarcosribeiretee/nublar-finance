import { thisMonth } from '../common/today';
import { shiftMonth } from '../ledger/month';
import { RecurringService } from './recurring.service';

type CreateManyArgs = {
  data: { occurrence: string; status: string }[];
  skipDuplicates: boolean;
};

describe('RecurringService.materialize', () => {
  const userId = '6d8f4a2e-1c3b-4e5a-9f70-1a2b3c4d5e6f';
  const current = thisMonth();

  function setup() {
    const db = {
      recurringRule: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'netflix',
            userId,
            type: 'EXPENSE',
            accountId: 'itau',
            categoryId: 'subs',
            amount: 4590n,
            description: 'Netflix',
            dayOfMonth: 8,
            startMonth: shiftMonth(current, -1),
            endMonth: null,
          },
        ]),
      },
      transaction: {
        createMany: jest.fn<Promise<{ count: number }>, [CreateManyArgs]>(),
      },
    };
    return { db, service: new RecurringService({ db } as never) };
  }

  it('creates pending occurrences idempotently', async () => {
    const { db, service } = setup();
    await service.materialize(userId, current);

    const [call] = db.transaction.createMany.mock.calls[0];
    expect(call.skipDuplicates).toBe(true);
    expect(call.data.map((row) => row.occurrence)).toEqual([
      shiftMonth(current, -1),
      current,
    ]);
    expect(call.data.every((row) => row.status === 'PENDING')).toBe(true);
  });

  it('does not go past the horizon', async () => {
    const { db, service } = setup();
    await service.materialize(userId, shiftMonth(current, 40));

    const [call] = db.transaction.createMany.mock.calls[0];
    expect(call.data.at(-1)?.occurrence).toBe(shiftMonth(current, 12));
  });

  it('skips the database when already up to date', async () => {
    const { db, service } = setup();
    await service.materialize(userId, current);
    await service.materialize(userId, current);

    expect(db.recurringRule.findMany).toHaveBeenCalledTimes(1);
  });
});
