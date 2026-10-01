import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from './auth-user';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {}

  async verify(token: string): Promise<AuthUser> {
    // getClaims checks the signature locally against the project's cached JWKS
    // (asymmetric keys) and only calls the Auth server for legacy HS256 tokens.
    const { data, error } = await this.client().auth.getClaims(token);
    const claims = data?.claims;

    if (error || !claims?.sub || typeof claims.email !== 'string') {
      throw new UnauthorizedException('Sessão inválida');
    }

    return { id: claims.sub, email: claims.email };
  }

  private client(): SupabaseClient {
    if (this.supabase) {
      return this.supabase;
    }

    const url = this.config.get<string>('SUPABASE_URL');
    const anonKey = this.config.get<string>('SUPABASE_ANON_KEY');
    if (!url || !anonKey) {
      throw new UnauthorizedException('Autenticação não configurada');
    }

    this.supabase = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return this.supabase;
  }
}
