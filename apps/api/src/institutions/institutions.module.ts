import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsService } from './institutions.service';

@Module({
  imports: [AuthModule, LedgerModule],
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
})
export class InstitutionsModule {}
