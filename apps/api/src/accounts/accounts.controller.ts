import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AccountsService } from './accounts.service';

@Controller('accounts')
@UseGuards(SupabaseAuthGuard)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.accounts.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.accounts.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.accounts.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accounts.remove(user.id, id);
  }
}
