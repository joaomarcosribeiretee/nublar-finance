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
import { InstitutionsService } from './institutions.service';

@Controller('institutions')
@UseGuards(SupabaseAuthGuard)
export class InstitutionsController {
  constructor(private readonly institutions: InstitutionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.institutions.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.institutions.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.institutions.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.institutions.remove(user.id, id);
  }
}
