import { UsersService } from './users.service';

describe('UsersService', () => {
  const user = {
    id: '6d8f4a2e-1c3b-4e5a-9f70-1a2b3c4d5e6f',
    email: 'ana@example.com',
  };

  function prismaWith(createdCount: number) {
    return {
      db: {
        user: {
          createMany: jest.fn().mockResolvedValue({ count: createdCount }),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        category: { createMany: jest.fn().mockResolvedValue({ count: 7 }) },
      },
    };
  }

  it('seeds starter categories only for a new user', async () => {
    const prisma = prismaWith(1);
    await new UsersService(prisma as never).ensure(user);

    expect(prisma.db.category.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });

  it('does not seed categories again for an existing user', async () => {
    const prisma = prismaWith(0);
    await new UsersService(prisma as never).ensure(user);

    expect(prisma.db.category.createMany).not.toHaveBeenCalled();
  });

  it('hits the database once per user per process', async () => {
    const prisma = prismaWith(0);
    const service = new UsersService(prisma as never);
    await service.ensure(user);
    await service.ensure(user);

    expect(prisma.db.user.createMany).toHaveBeenCalledTimes(1);
  });
});
