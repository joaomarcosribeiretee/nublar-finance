import { Injectable } from '@nestjs/common';
import {
  DEFAULT_PREFERENCES,
  localeSchema,
  onboardingStateSchema,
  updatePreferencesSchema,
  type Preferences,
} from '@nublar/validation';
import { parseBody } from '../common/parse-body';
import type { UserPreferences } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** A stored value that no longer parses falls back to its default. */
function serialize(row: UserPreferences): Preferences {
  return {
    theme: row.theme,
    locale: localeSchema.catch(DEFAULT_PREFERENCES.locale).parse(row.locale),
    currency: DEFAULT_PREFERENCES.currency,
    monthStartDay: row.monthStartDay,
    hideValues: row.hideValues,
    onboardingState: onboardingStateSchema
      .catch(DEFAULT_PREFERENCES.onboardingState)
      .parse(row.onboardingState),
    tipsSeen: row.tipsSeen,
  };
}

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates the row with the defaults on first read. */
  async get(userId: string): Promise<Preferences> {
    const found = await this.prisma.db.userPreferences.findUnique({
      where: { userId },
    });
    if (found) {
      return serialize(found);
    }

    // Concurrent first reads must not fail on each other.
    await this.prisma.db.userPreferences.createMany({
      data: [{ userId }],
      skipDuplicates: true,
    });
    return serialize(
      await this.prisma.db.userPreferences.findUniqueOrThrow({
        where: { userId },
      }),
    );
  }

  async update(userId: string, body: unknown): Promise<Preferences> {
    const patch = parseBody(updatePreferencesSchema, body);
    const row = await this.prisma.db.userPreferences.upsert({
      where: { userId },
      create: { userId, ...patch },
      update: patch,
    });
    return serialize(row);
  }
}
