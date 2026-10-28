import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { SessionRevocationService } from './session-revocation.service';
import type { AuthUser } from './strategies/jwt.strategy';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessions: SessionRevocationService,
  ) {}

  async login(email: string, password: string): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user || !user.isActive)
      throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // sid: one id per login, carried into every token the sliding session
    // re-issues, so logout can revoke the whole session (see
    // SessionRevocationService).
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: randomUUID(),
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  // Throws 503 if the revocation can't be recorded — logout is only
  // reported as done once it is.
  async logout(user: AuthUser): Promise<void> {
    await this.sessions.revoke({
      sub: user.id,
      sid: user.sid,
      iat: user.iat,
      exp: user.exp,
    });
  }
}
