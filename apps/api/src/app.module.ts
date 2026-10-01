import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountsModule } from './accounts/accounts.module';
import { CardsModule } from './cards/cards.module';
import { CategoriesModule } from './categories/categories.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { InvestmentsModule } from './investments/investments.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PlanningModule } from './planning/planning.module';
import { ImportsModule } from './imports/imports.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RecurringModule } from './recurring/recurring.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    CardsModule,
    InstitutionsModule,
    InvestmentsModule,
    AnalyticsModule,
    PlanningModule,
    ImportsModule,
    RecurringModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
