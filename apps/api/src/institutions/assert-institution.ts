import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/** Accounts and cards may only be attached to the user's own institutions. */
export async function assertInstitution(
  prisma: PrismaService,
  userId: string,
  institutionId: string | null | undefined,
): Promise<void> {
  if (!institutionId) {
    return;
  }
  const institution = await prisma.db.institution.findFirst({
    where: { id: institutionId, userId },
    select: { id: true },
  });
  if (!institution) {
    throw new NotFoundException('Instituição não encontrada');
  }
}
