import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { SessionRevocationService } from '../session-revocation.service';

// Browser clients authenticate via the httpOnly `access_token` cookie;
// the Bearer header stays supported for scripts/tools (curl, Swagger).
const cookieExtractor = (req: Request): string | null =>
  req?.cookies?.access_token ?? null;

// What every authenticated request gets as req.user. sid/iat/exp are carried
// for SlidingSessionInterceptor (re-issues under the same sid) and logout
// (revokes the sid until the session's newest token has expired).
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  sid: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private sessions: SessionRevocationService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET must be defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // Throws 401 (revoked / inactive / pre-password-change / no session id)
  // or 503 (the check itself couldn't be made — never let the request
  // through in that case).
  async validate(payload: any): Promise<AuthUser> {
    await this.sessions.assertSessionValid(payload);
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      sid: payload.sid,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}
