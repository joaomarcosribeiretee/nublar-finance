import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private client: PrismaClient | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const connectionString = this.config.get<string>('DATABASE_URL');
    if (!connectionString) {
      this.logger.warn('DATABASE_URL is missing. Database checks will fail.');
      return;
    }

    try {
      const adapter = new PrismaPg({
        connectionString,
        connectionTimeoutMillis: 2000,
      });
      this.client = new PrismaClient({ adapter });
      await this.client.$connect();
    } catch (error: unknown) {
      this.client = null;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Database is unavailable: ${message}`);
    }
  }

  async onModuleDestroy() {
    await this.client?.$disconnect();
  }

  async isConnected(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
