import { Controller, Get } from '@nestjs/common';
import type { ServiceHealth } from '@nublar/validation';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth(): Promise<ServiceHealth> {
    const databaseUp = await this.prisma.isConnected();

    return {
      status: databaseUp ? 'ok' : 'degraded',
      service: 'nublar-api',
      database: databaseUp ? 'up' : 'down',
    };
  }
}
