import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createCategorySchema } from '@nublar/validation';
import { parseBody } from '../common/parse-body';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const categories = await this.prisma.db.category.findMany({
      where: { userId },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            transactions: true,
            cardPurchases: true,
            recurringRules: true,
          },
        },
      },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      kind: category.kind,
      usage: usageOf(category._count),
    }));
  }

  async create(userId: string, body: unknown) {
    const input = parseBody(createCategorySchema, body);
    try {
      const category = await this.prisma.db.category.create({
        data: {
          userId,
          name: input.name,
          kind: input.kind,
        },
      });

      return {
        id: category.id,
        name: category.name,
        kind: category.kind,
        usage: 0,
      };
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Já existe uma categoria com esse nome');
      }
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    const category = await this.prisma.db.category.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: {
            transactions: true,
            cardPurchases: true,
            recurringRules: true,
          },
        },
      },
    });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }
    if (usageOf(category._count) > 0) {
      throw new ConflictException(
        'Categoria em uso. Altere os lançamentos antes de removê-la.',
      );
    }

    await this.prisma.db.category.delete({ where: { id } });
  }
}

/** Anything that would block deleting the category (installments included). */
function usageOf(count: {
  transactions: number;
  cardPurchases: number;
  recurringRules: number;
}): number {
  return count.transactions + count.cardPurchases + count.recurringRules;
}
