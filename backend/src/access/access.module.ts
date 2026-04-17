import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessService } from './access.service';
import { AccessController } from './access.controller';
import { AccessScheduler } from './access.scheduler';
import { AccessLog } from './entities/access-log.entity';
import { ServersModule } from '../servers/servers.module';
import { ClientsModule } from '../clients/clients.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TintaCoreModule } from '../tinta-core/tinta-core.module';

@Module({
  imports: [TypeOrmModule.forFeature([AccessLog]), ServersModule, ClientsModule, NotificationsModule, TintaCoreModule],
  providers: [AccessService, AccessScheduler],
  controllers: [AccessController],
  exports: [AccessService],
})
export class AccessModule {}
