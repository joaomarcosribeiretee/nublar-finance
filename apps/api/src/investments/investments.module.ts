import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';
import { InvestmentsController } from './investments.controller';
import { InvestmentsService } from './investments.service';

@Module({
  imports: [AuthModule, LedgerModule],
  controllers: [InvestmentsController],
  providers: [InvestmentsService],
})
export class InvestmentsModule {}
