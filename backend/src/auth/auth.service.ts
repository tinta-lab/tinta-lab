import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { ClientsService } from '../clients/clients.service';
import { TokenBlacklistService } from './token-blacklist.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly clientsService: ClientsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly blacklist: TokenBlacklistService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user || !user.isActive)
      throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, email: user.email, role: user.role };
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

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    city?: string;
  }) {
    await this.clientsService.create(data);
    // Auto-login after registration
    return this.login(data.email, data.password);
  }

  async logout(token: string): Promise<void> {
    try {
      const decoded = this.jwtService.decode(token);
      if (decoded?.sub && decoded?.iat && decoded?.exp) {
        await this.blacklist.add(decoded.sub, decoded.iat, decoded.exp);
      }
    } catch {
      // Invalid token — nothing to blacklist
    }
  }
}
