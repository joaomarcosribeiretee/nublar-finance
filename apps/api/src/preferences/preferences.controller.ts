import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PreferencesService } from './preferences.service';

@Controller('me/preferences')
@UseGuards(SupabaseAuthGuard)
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.preferences.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.preferences.update(user.id, body);
  }
}
