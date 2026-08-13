import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GoldenTemplate } from './entities/golden-template.entity';
import { AgentSession } from './entities/agent-session.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { AccessLog } from '../access/entities/access-log.entity';
import { TintaAgentGateway } from './tinta-agent.gateway';
import { GoldenTemplateService } from './golden-template.service';
import { GoldenTemplateSeedService } from './golden-template-seed.service';
import { TintaCoreService } from './tinta-core.service';
import { TintaCoreController } from './tinta-core.controller';
import { AgentMonitorScheduler } from './agent-monitor.scheduler';
import { ServersModule } from '../servers/servers.module';
import { AuditModule } from '../access/audit.module';
import { CloudflareModule } from '../cloudflare/cloudflare.module';
import { AccessModule } from '../access/access.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GoldenTemplate, AgentSession, Ticket, AccessLog]),
    ServersModule,
    AuditModule,
    CloudflareModule,
    NotificationsModule,
    // AccessModule imports TintaCoreModule (for TintaAgentGateway push events);
    // TintaAgentGateway now also calls back into AccessService for the HA
    // toggle path — forwardRef breaks the resulting 2-module cycle.
    forwardRef(() => AccessModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('AGENT_JWT_SECRET', config.get('JWT_SECRET')),
        signOptions: { expiresIn: '365d' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    TintaAgentGateway,
    GoldenTemplateService,
    GoldenTemplateSeedService,
    TintaCoreService,
    AgentMonitorScheduler,
  ],
  controllers: [TintaCoreController],
  exports: [TintaCoreService, TintaAgentGateway, GoldenTemplateService],
})
export class TintaCoreModule {}
