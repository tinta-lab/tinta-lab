import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessService } from './access.service';
import { AccessController } from './access.controller';
import { AccessScheduler } from './access.scheduler';
import { AccessLog } from './entities/access-log.entity';
import { ServersModule } from '../servers/servers.module';
import { ClientsModule } from '../clients/clients.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([AccessLog]), ServersModule, ClientsModule, NotificationsModule],
  providers: [AccessService, AccessScheduler],
  controllers: [AccessController],
  exports: [AccessService],
})
export class AccessModule {}
