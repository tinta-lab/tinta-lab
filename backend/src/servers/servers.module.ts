import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServersService } from './servers.service';
import { ServersController } from './servers.controller';
import { ServersGateway } from './servers.gateway';
import { Server } from './entities/server.entity';
import { ClientsModule } from '../clients/clients.module';
import { CloudflareModule } from '../cloudflare/cloudflare.module';
import { AuthModule } from '../auth/auth.module';
import { PresenceModule } from '../presence/presence.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Server]),
    ClientsModule,
    CloudflareModule,
    AuthModule, // provides TokenBlacklistService
    PresenceModule,
    UsersModule, // provides UsersService.getAuthMeta for the passwordChangedAt check
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '15m') },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [ServersService, ServersGateway],
  controllers: [ServersController],
  exports: [ServersService, ServersGateway],
})
export class ServersModule {}
