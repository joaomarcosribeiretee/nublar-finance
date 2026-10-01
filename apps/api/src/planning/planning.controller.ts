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
import { BudgetsService } from './budgets.service';
import { GoalsService } from './goals.service';
import { PlanningService } from './planning.service';

@Controller()
@UseGuards(SupabaseAuthGuard)
export class PlanningController {
  constructor(
    private readonly budgets: BudgetsService,
    private readonly goals: GoalsService,
    private readonly planning: PlanningService,
  ) {}

  @Get('budgets')
  listBudgets(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    return this.budgets.list(user.id, month ?? thisMonth());
  }

  @Put('budgets')
  upsertBudget(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.budgets.upsert(user.id, body);
  }

  @Delete('budgets/:id')
  @HttpCode(204)
  removeBudget(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.budgets.remove(user.id, id);
  }

  @Get('goals')
  listGoals(@CurrentUser() user: AuthUser) {
    return this.goals.list(user.id);
  }

  @Post('goals')
  createGoal(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.goals.create(user.id, body);
  }

  @Put('goals/:id')
  updateGoal(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.goals.update(user.id, id, body);
  }

  @Delete('goals/:id')
  @HttpCode(204)
  removeGoal(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.goals.remove(user.id, id);
  }

  @Get('calendar')
  calendar(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    return this.planning.calendar(user.id, month ?? thisMonth());
  }

  @Get('projection')
  projection(@CurrentUser() user: AuthUser, @Query('months') months?: string) {
    return this.planning.projection(user.id, months);
  }
}
