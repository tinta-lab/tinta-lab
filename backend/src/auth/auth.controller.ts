import {
  Controller,
  Post,
  Patch,
  Body,
  HttpCode,
  UseGuards,
  Request,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ClientsService } from '../clients/clients.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateClientDto } from '../clients/dto/update-client.dto';
import { AUTH_COOKIE, AUTH_COOKIE_MAX_AGE_MS, authCookieOptions } from './auth-cookie.constants';

// Same cookie name/domain the frontend previously set from JS for `tl_locale`
// — shared across app./api. subdomains. Now httpOnly: JS can no longer read
// the token (closes the XSS-steals-localStorage-token vector); the browser
// just attaches it automatically on same-site requests.
const AUTH_COOKIE_OPTS = authCookieOptions(process.env.COOKIE_DOMAIN ?? '.tinta-lab.de');

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly clientsService: ClientsService,
  ) {}

  // 10 attempts per 15 minutes per IP — prevents brute-force.
  // access_token is still returned in the body for non-browser callers
  // (provision-client.sh, curl, Swagger "try it") that can't rely on cookies;
  // the browser dashboard ignores the body token and relies on the cookie.
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 900_000, limit: 10 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto.email, dto.password);
    res.cookie(AUTH_COOKIE, result.access_token, {
      ...AUTH_COOKIE_OPTS,
      maxAge: AUTH_COOKIE_MAX_AGE_MS,
    });
    return result;
  }

  // Public self-registration is disabled — accounts are created by admin via POST /users
  @Post('register')
  @Throttle({ default: { ttl: 3_600_000, limit: 5 } })
  register() {
    throw new ForbiddenException('Self-registration is disabled. Contact your administrator.');
  }

  // Logout is authenticated — no brute-force risk
  @Post('logout')
  @HttpCode(204)
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const token =
      req.cookies?.[AUTH_COOKIE] ?? req.headers.authorization?.replace('Bearer ', '');
    if (token) await this.authService.logout(token);
    res.clearCookie(AUTH_COOKIE, AUTH_COOKIE_OPTS);
  }

  // Self-service — requires the current password, invalidates every token
  // issued before now (see JwtStrategy: rejects iat < passwordChangedAt).
  @Post('change-password')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request() req: any,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.usersService.changeOwnPassword(
      req.user.id,
      dto.oldPassword,
      dto.newPassword,
    );
    // The cookie's own token is now invalid (iat < passwordChangedAt) — clear
    // it so the next request cleanly 401s instead of retrying a dead token.
    res.clearCookie(AUTH_COOKIE, AUTH_COOKIE_OPTS);
  }

  // Self-service profile — own name only, any role.
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Request() req: any, @Body() dto: UpdateMeDto) {
    return this.usersService.updateOwnProfile(req.user.id, dto);
  }

  // Self-service profile — phone/city on the caller's own Client record.
  @Patch('me/client-profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT)
  async updateMyClientProfile(@Request() req: any, @Body() dto: UpdateClientDto) {
    const client = await this.clientsService.findByUserId(req.user.id);
    return this.clientsService.update(client.id, dto);
  }
}
