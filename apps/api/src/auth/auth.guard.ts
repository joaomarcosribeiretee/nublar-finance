import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { AuthUser } from './auth-user';
import { AuthService } from './auth.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Sessão inválida');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Sessão inválida');
    }

    const user = await this.auth.verify(token);
    await this.users.ensure(user);
    request.user = user;
    return true;
  }
}
