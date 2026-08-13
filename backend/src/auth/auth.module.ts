import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { ClientsModule } from '../clients/clients.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenBlacklistService } from './token-blacklist.service';
import { SlidingSessionInterceptor } from './sliding-session.interceptor';

@Module({
  imports: [
    UsersModule,
    ClientsModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '15m') },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    TokenBlacklistService,
    { provide: APP_INTERCEPTOR, useClass: SlidingSessionInterceptor },
  ],
  controllers: [AuthController],
  exports: [AuthService, TokenBlacklistService],
})
export class AuthModule {}
