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
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CardsService } from './cards.service';

@Controller()
@UseGuards(SupabaseAuthGuard)
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get('cards')
  list(@CurrentUser() user: AuthUser) {
    return this.cards.list(user.id);
  }

  @Post('cards')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.cards.create(user.id, body);
  }

  @Put('cards/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.cards.update(user.id, id, body);
  }

  @Delete('cards/:id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cards.remove(user.id, id);
  }

  @Get('cards/:id/invoices/:month')
  invoice(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('month') month: string,
  ) {
    return this.cards.invoice(user.id, id, month);
  }

  @Post('cards/:id/payments')
  pay(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.cards.pay(user.id, id, body);
  }

  @Post('card-purchases')
  createPurchase(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.cards.createPurchase(user.id, body);
  }

  @Put('card-purchases/:id')
  updatePurchase(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.cards.updatePurchase(user.id, id, body);
  }

  @Delete('card-purchases/:id')
  @HttpCode(204)
  removePurchase(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cards.removePurchase(user.id, id);
  }
}
