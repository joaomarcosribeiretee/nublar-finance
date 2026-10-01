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
import { RecurringService } from './recurring.service';

@Controller('recurring')
@UseGuards(SupabaseAuthGuard)
export class RecurringController {
  constructor(private readonly recurring: RecurringService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.recurring.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.recurring.create(user.id, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.recurring.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recurring.remove(user.id, id);
  }
}
