import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { resolveLocale } from '@nublar/validation';
import type { AuthUser } from '../auth/auth-user';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PreferencesService } from './preferences.service';

@Controller('me/preferences')
@UseGuards(SupabaseAuthGuard)
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  get(
    @CurrentUser() user: AuthUser,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    // The app sends the system language on first launch, so a new user
    // starts in it.
    return this.preferences.get(
      user.id,
      acceptLanguage ? resolveLocale(acceptLanguage) : undefined,
    );
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.preferences.update(user.id, body);
  }
}
