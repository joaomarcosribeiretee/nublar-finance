import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth-user';
import { STARTER_CATEGORIES } from './starter-categories';

@Injectable()
export class UsersService {
  /** Users already provisioned by this process; skips the round trip on every request. */
  private readonly known = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async ensure(authUser: AuthUser): Promise<void> {
    if (this.known.has(authUser.id)) {
      return;
    }

    // The desktop fires several requests at once on first sign-in, so both
    // writes must tolerate a concurrent request having done them already.
    const created = await this.prisma.db.user.createMany({
      data: [{ id: authUser.id, email: authUser.email }],
      skipDuplicates: true,
    });

    if (created.count > 0) {
      await this.prisma.db.category.createMany({
        data: STARTER_CATEGORIES.map((category) => ({
          userId: authUser.id,
          name: category.name,
          kind: category.kind,
        })),
        skipDuplicates: true,
      });
    } else {
      await this.prisma.db.user.updateMany({
        where: { id: authUser.id, NOT: { email: authUser.email } },
        data: { email: authUser.email },
      });
    }

    this.known.add(authUser.id);
  }
}
