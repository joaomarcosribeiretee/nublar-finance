import { BadRequestException } from '@nestjs/common';
import type { ZodType } from 'zod';

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException(
      parsed.error.issues[0]?.message ?? 'Invalid input',
    );
  }
  return parsed.data;
}
