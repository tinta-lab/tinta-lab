import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 10 attempts per 15 minutes per IP — prevents brute-force
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 900_000, limit: 10 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
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
  async logout(@Request() req: any) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) await this.authService.logout(token);
  }
}
