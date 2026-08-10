import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Client } from '../clients/entities/client.entity';
import { CloudflareModule } from '../cloudflare/cloudflare.module';
import { PresenceModule } from '../presence/presence.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Client]),
    CloudflareModule,
    PresenceModule,
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
