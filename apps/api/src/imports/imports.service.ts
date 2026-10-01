import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { importCommitSchema, importPreviewSchema } from '@nublar/validation';
import { parseBody } from '../common/parse-body';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_KEYWORDS,
  merchantKey,
  parseCsv,
  parseOfx,
  suggestCategory,
  type ParsedRow,
} from './parsers';

/** Rows the user is likely to have recorded already. */
export function findDuplicates(
  rows: ParsedRow[],
  existing: { date: string; amount: bigint; importKey: string | null }[],
): boolean[] {
  const keys = new Set(existing.map((e) => e.importKey).filter(Boolean));
  // Each existing entry can only explain one imported row.
  const pool = new Map<string, number>();
  for (const entry of existing) {
    const key = `${entry.date}|${entry.amount}`;
    pool.set(key, (pool.get(key) ?? 0) + 1);
  }
  return rows.map((row) => {
    if (row.externalId && keys.has(row.externalId)) return true;
    const key = `${row.date}|${row.amount}`;
    const left = pool.get(key) ?? 0;
    if (left > 0) {
      pool.set(key, left - 1);
      return true;
    }
    return false;
  });
}

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Parses the file and says what each row would become. Writes nothing. */
  async preview(userId: string, body: unknown) {
    const input = parseBody(importPreviewSchema, body);
    await this.assertAccount(userId, input.accountId);

    let parsed: ParsedRow[];
    let csv: ReturnType<typeof parseCsv> | null = null;
    if (input.format === 'OFX') {
      parsed = parseOfx(input.content);
    } else {
      csv = parseCsv(input.content, input.mapping);
      parsed = csv.rows;
    }

    if (parsed.length === 0) {
      return {
        rows: [],
        csv: csv
          ? { header: csv.header, mapping: csv.mapping, sample: csv.sample }
          : null,
      };
    }

    const dates = parsed.map((row) => row.date).sort();
    const [existing, categories, rules] = await Promise.all([
      this.prisma.db.transaction.findMany({
        where: {
          userId,
          accountId: input.accountId,
          status: { not: 'CANCELED' },
          date: {
            gte: new Date(`${dates[0]}T00:00:00.000Z`),
            lte: new Date(`${dates[dates.length - 1]}T00:00:00.000Z`),
          },
        },
        select: { date: true, amount: true, type: true, importKey: true },
      }),
      this.prisma.db.category.findMany({
        where: { userId },
        select: { id: true, name: true, kind: true },
      }),
      this.prisma.db.categoryRule.findMany({
        where: { userId },
        select: { keyword: true, categoryId: true },
      }),
    ]);

    const signed = existing.map((entry) => ({
      date: entry.date.toISOString().slice(0, 10),
      amount:
        entry.type === 'INCOME' || entry.type === 'REDEMPTION'
          ? entry.amount
          : -entry.amount,
      importKey: entry.importKey,
    }));
    const duplicates = findDuplicates(parsed, signed);
    const kindOf = new Map(categories.map((c) => [c.id, c.kind]));
    const byName = new Map(
      categories.map((c) => [`${c.kind}:${c.name}`, c.id]),
    );

    const rows = parsed.map((row, index) => {
      const kind = row.amount < 0n ? 'EXPENSE' : 'INCOME';
      const fitting = (list: { keyword: string; categoryId: string }[]) =>
        list.filter((rule) => kindOf.get(rule.categoryId) === kind);
      const defaults = DEFAULT_KEYWORDS.flatMap(([keyword, name]) => {
        const id = byName.get(`${kind}:${name}`);
        return id ? [{ keyword, categoryId: id }] : [];
      });
      return {
        index,
        date: row.date,
        description: row.description.slice(0, 200),
        amount: row.amount.toString(),
        type: kind,
        externalId: row.externalId,
        duplicate: duplicates[index],
        suggestedCategoryId: suggestCategory(
          row.description,
          fitting(rules),
          defaults,
        ),
      };
    });

    return {
      rows,
      csv: csv
        ? { header: csv.header, mapping: csv.mapping, sample: csv.sample }
        : null,
    };
  }

  /**
   * Creates the chosen rows and learns from them: the merchant of each row
   * becomes a rule pointing at the category the user picked.
   */
  async commit(userId: string, body: unknown) {
    const input = parseBody(importCommitSchema, body);
    await this.assertAccount(userId, input.accountId);
    const categories = await this.prisma.db.category.findMany({
      where: {
        userId,
        id: { in: [...new Set(input.rows.map((r) => r.categoryId))] },
      },
      select: { id: true, kind: true },
    });
    const kindOf = new Map(categories.map((c) => [c.id, c.kind]));
    for (const row of input.rows) {
      const kind = kindOf.get(row.categoryId);
      if (!kind) throw new NotFoundException('Categoria não encontrada');
      if (kind !== (row.amount < 0n ? 'EXPENSE' : 'INCOME')) {
        throw new BadRequestException(
          `A categoria de "${row.description}" não combina com o sinal do valor`,
        );
      }
    }

    const created = await this.prisma.db.transaction.createMany({
      data: input.rows.map((row) => ({
        userId,
        type: row.amount < 0n ? ('EXPENSE' as const) : ('INCOME' as const),
        accountId: input.accountId,
        categoryId: row.categoryId,
        amount: row.amount < 0n ? -row.amount : row.amount,
        description: row.description,
        date: new Date(`${row.date}T00:00:00.000Z`),
        source: input.source,
        status: 'POSTED' as const,
        importKey: row.externalId ?? null,
      })),
      skipDuplicates: true,
    });

    const learned = new Map<string, string>();
    for (const row of input.rows) {
      const keyword = merchantKey(row.description);
      if (keyword.length >= 3) learned.set(keyword, row.categoryId);
    }
    for (const [keyword, categoryId] of learned) {
      await this.prisma.db.categoryRule.upsert({
        where: { userId_keyword: { userId, keyword } },
        create: { userId, keyword, categoryId },
        update: { categoryId },
      });
    }

    return {
      imported: created.count,
      skipped: input.rows.length - created.count,
      learned: learned.size,
    };
  }

  private async assertAccount(userId: string, accountId: string) {
    const account = await this.prisma.db.account.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });
    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }
  }
}
