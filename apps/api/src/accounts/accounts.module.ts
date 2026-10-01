import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [AuthModule, LedgerModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
