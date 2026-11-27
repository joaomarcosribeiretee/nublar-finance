import { BadRequestException } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Schema messages are keys ("chooseCategory"); ValidationMessageFilter
 * turns them into text in the request's language.
 */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException(
      parsed.error.issues[0]?.message ?? 'Invalid input',
    );
  }
  return parsed.data;
}
