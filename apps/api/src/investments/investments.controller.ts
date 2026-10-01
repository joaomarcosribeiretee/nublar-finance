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
import { InvestmentsService } from './investments.service';

@Controller('investments')
@UseGuards(SupabaseAuthGuard)
export class InvestmentsController {
  constructor(private readonly investments: InvestmentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.investments.list(user.id);
  }

  @Post('valuations')
  addValuations(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.investments.addValuations(user.id, body);
  }

  @Get(':id')
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.investments.detail(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.investments.create(user.id, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.investments.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.investments.remove(user.id, id);
  }

  @Post(':id/movements')
  move(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.investments.move(user.id, id, body);
  }

  @Post(':id/valuations')
  addValuation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.investments.addValuation(user.id, id, body);
  }

  @Delete(':id/valuations/:valuationId')
  @HttpCode(204)
  removeValuation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('valuationId', ParseUUIDPipe) valuationId: string,
  ) {
    return this.investments.removeValuation(user.id, id, valuationId);
  }
}
