import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LedgerModule } from '../ledger/ledger.module';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';

@Module({
  imports: [AuthModule, LedgerModule],
  controllers: [CardsController],
  providers: [CardsService],
})
export class CardsModule {}
