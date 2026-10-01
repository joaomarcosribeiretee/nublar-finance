import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from './auth.guard';

@Module({
  imports: [UsersModule],
  providers: [AuthService, SupabaseAuthGuard],
  exports: [AuthService, SupabaseAuthGuard, UsersModule],
})
export class AuthModule {}
