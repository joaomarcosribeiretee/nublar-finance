import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(SupabaseAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  overview(
    @CurrentUser() user: AuthUser,
    @Query('to') to?: string,
    @Query('months') months?: string,
  ) {
    return this.analytics.overview(user.id, to, months);
  }
}
