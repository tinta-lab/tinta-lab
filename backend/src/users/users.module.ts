import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Client } from '../clients/entities/client.entity';
import { CloudflareModule } from '../cloudflare/cloudflare.module';
import { ServersModule } from '../servers/servers.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Client]),
    CloudflareModule,
    ServersModule,
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
