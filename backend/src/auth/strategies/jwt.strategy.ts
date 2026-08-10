import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { TokenBlacklistService } from '../token-blacklist.service';
import { UsersService } from '../../users/users.service';

// Browser clients authenticate via the httpOnly `access_token` cookie;
// the Bearer header stays supported for scripts/tools (e.g. provision-client.sh).
const cookieExtractor = (req: Request): string | null =>
  req?.cookies?.access_token ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private blacklist: TokenBlacklistService,
    private usersService: UsersService,
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

  async validate(payload: any) {
    if (await this.blacklist.isBlacklisted(payload.sub, payload.iat)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Reject tokens issued before the user's last password change — closes
    // the window where a leaked token would otherwise outlive a reset.
    const meta = await this.usersService.getAuthMeta(payload.sub);
    if (meta?.passwordChangedAt && payload.iat) {
      const changedAtSeconds = Math.floor(meta.passwordChangedAt.getTime() / 1000);
      if (payload.iat < changedAtSeconds) {
        throw new UnauthorizedException('Token invalidated by password change');
      }
    }

    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
