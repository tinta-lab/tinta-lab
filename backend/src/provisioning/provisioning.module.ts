import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/entities/client.entity';
import { Server } from '../servers/entities/server.entity';
import { ClientsModule } from '../clients/clients.module';
import { UsersModule } from '../users/users.module';
import { ServersModule } from '../servers/servers.module';
import { TintaCoreModule } from '../tinta-core/tinta-core.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProvisioningService } from './provisioning.service';
import { ProvisioningController } from './provisioning.controller';
import { InstallController } from './install.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, Server]),
    ClientsModule,
    UsersModule,
    ServersModule,
    TintaCoreModule,
    NotificationsModule,
  ],
  providers: [ProvisioningService],
  controllers: [ProvisioningController, InstallController],
  exports: [ProvisioningService],
})
export class ProvisioningModule {}
