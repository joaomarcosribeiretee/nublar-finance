import { BadRequestException } from '@nestjs/common';
import { DEFAULT_PREFERENCES } from '@nublar/validation';
import { PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  const userId = '6d8f4a2e-1c3b-4e5a-9f70-1a2b3c4d5e6f';

  /** What the database returns for a fresh row. */
  function row(overrides: Record<string, unknown> = {}) {
    return {
      userId,
      theme: 'DARK',
      locale: 'pt-BR',
      currency: 'BRL',
      monthStartDay: 1,
      hideValues: false,
      onboardingState: { completed: false, step: null, skipped: false },
      tipsSeen: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  function prismaWith(stored: ReturnType<typeof row> | null) {
    const table = {
      findUnique: jest.fn().mockResolvedValue(stored),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(row()),
      upsert: jest
        .fn()
        .mockImplementation(({ update }: { update: object }) =>
          Promise.resolve(row(update as Record<string, unknown>)),
        ),
    };
    return { db: { userPreferences: table }, table };
  }

  describe('get', () => {
    it('creates the defaults on first read', async () => {
      const { table, ...prisma } = prismaWith(null);
      const result = await new PreferencesService(prisma as never).get(userId);

      expect(table.createMany).toHaveBeenCalledWith({
        data: [{ userId }],
        skipDuplicates: true,
      });
      expect(result).toEqual(DEFAULT_PREFERENCES);
    });

    it('returns what is stored without writing', async () => {
      const { table, ...prisma } = prismaWith(
        row({ theme: 'LIGHT', hideValues: true, tipsSeen: ['home'] }),
      );
      const result = await new PreferencesService(prisma as never).get(userId);

      expect(table.createMany).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        theme: 'LIGHT',
        hideValues: true,
        tipsSeen: ['home'],
      });
    });

    it('falls back to defaults for stored values that no longer parse', async () => {
      const { ...prisma } = prismaWith(
        row({ locale: 'fr', onboardingState: { broken: true } }),
      );
      const result = await new PreferencesService(prisma as never).get(userId);

      expect(result.locale).toBe('pt-BR');
      expect(result.onboardingState).toEqual(
        DEFAULT_PREFERENCES.onboardingState,
      );
    });

    it('does not expose internal columns', async () => {
      const { ...prisma } = prismaWith(row());
      const result = await new PreferencesService(prisma as never).get(userId);

      expect(Object.keys(result).sort()).toEqual(
        Object.keys(DEFAULT_PREFERENCES).sort(),
      );
    });
  });

  describe('update', () => {
    it('writes only the fields sent', async () => {
      const { table, ...prisma } = prismaWith(null);
      const result = await new PreferencesService(prisma as never).update(
        userId,
        { theme: 'SYSTEM', monthStartDay: 5 },
      );

      expect(table.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: { userId, theme: 'SYSTEM', monthStartDay: 5 },
        update: { theme: 'SYSTEM', monthStartDay: 5 },
      });
      expect(result).toMatchObject({ theme: 'SYSTEM', monthStartDay: 5 });
    });

    it('drops fields it does not know', async () => {
      const { table, ...prisma } = prismaWith(null);
      await new PreferencesService(prisma as never).update(userId, {
        hideValues: true,
        userId: 'someone-else',
      });

      expect(table.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { hideValues: true } }),
      );
    });

    it.each([
      { monthStartDay: 29 },
      { monthStartDay: 0 },
      { theme: 'BLUE' },
      { locale: 'fr' },
      { currency: 'USD' },
      { onboardingState: { completed: true } },
    ])('rejects %o', async (body) => {
      const { table, ...prisma } = prismaWith(null);
      await expect(
        new PreferencesService(prisma as never).update(userId, body),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(table.upsert).not.toHaveBeenCalled();
    });
  });
});
