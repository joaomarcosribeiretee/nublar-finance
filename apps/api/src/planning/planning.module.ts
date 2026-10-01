import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';
import { RecurringModule } from '../recurring/recurring.module';
import { BudgetsService } from './budgets.service';
import { GoalsService } from './goals.service';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';

@Module({
  imports: [AuthModule, LedgerModule, RecurringModule],
  controllers: [PlanningController],
  providers: [BudgetsService, GoalsService, PlanningService],
})
export class PlanningModule {}
