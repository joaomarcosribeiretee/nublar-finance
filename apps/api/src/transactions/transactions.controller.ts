import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { thisMonth } from '../common/today';
import { TransactionsService } from './transactions.service';

@Controller()
@UseGuards(SupabaseAuthGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get('transactions')
  list(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    return this.transactions.list(user.id, month);
  }

  @Post('transactions')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.transactions.create(user.id, body);
  }

  @Put('transactions/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.transactions.update(user.id, id, body);
  }

  @Delete('transactions/:id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactions.remove(user.id, id);
  }

  @Post('transactions/:id/confirm')
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.transactions.confirm(user.id, id, body);
  }

  @Post('transactions/:id/skip')
  @HttpCode(204)
  skip(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.transactions.skip(user.id, id);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    return this.transactions.summary(user.id, month ?? thisMonth());
  }
}
