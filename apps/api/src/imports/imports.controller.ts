import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ImportsService } from './imports.service';

@Controller('imports')
@UseGuards(SupabaseAuthGuard)
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post('preview')
  preview(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.imports.preview(user.id, body);
  }

  @Post('commit')
  commit(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.imports.commit(user.id, body);
  }
}
