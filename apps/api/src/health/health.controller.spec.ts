import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { isConnected: jest.Mock };

  beforeEach(async () => {
    prisma = { isConnected: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('reports ok when the database answers', async () => {
    prisma.isConnected.mockResolvedValue(true);

    await expect(controller.getHealth()).resolves.toEqual({
      status: 'ok',
      service: 'nublar-api',
      database: 'up',
    });
  });

  it('reports degraded when the database is down', async () => {
    prisma.isConnected.mockResolvedValue(false);

    await expect(controller.getHealth()).resolves.toEqual({
      status: 'degraded',
      service: 'nublar-api',
      database: 'down',
    });
  });
});
