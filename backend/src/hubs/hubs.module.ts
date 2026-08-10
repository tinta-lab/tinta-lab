import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Server } from '../servers/entities/server.entity';
import { AgentSession } from '../tinta-core/entities/agent-session.entity';
import { HubsService } from './hubs.service';
import { HubsController } from './hubs.controller';
import { TintaCoreModule } from '../tinta-core/tinta-core.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Server, AgentSession]),
    TintaCoreModule,
    ConfigModule,
  ],
  providers: [HubsService],
  controllers: [HubsController],
  exports: [HubsService],
})
export class HubsModule {}
