import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { ServersModule } from './servers/servers.module';
import { AccessModule } from './access/access.module';
import { TicketsModule } from './tickets/tickets.module';
import { TintaCoreModule } from './tinta-core/tinta-core.module';
import { ProvisioningModule } from './provisioning/provisioning.module';
import { User } from './users/entities/user.entity';
import { Client } from './clients/entities/client.entity';
import { Server } from './servers/entities/server.entity';
import { AccessLog } from './access/entities/access-log.entity';
import { AuditEvent } from './access/entities/audit-event.entity';
import { Ticket } from './tickets/entities/ticket.entity';
import { GoldenTemplate } from './tinta-core/entities/golden-template.entity';
import { AgentSession } from './tinta-core/entities/agent-session.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Global rate limit: 100 req / 60s per IP
    // Auth endpoints override with stricter limits via @Throttle()
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'tinta'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME', 'tinta_lab'),
        entities: [
          User,
          Client,
          Server,
          AccessLog,
          AuditEvent,
          Ticket,
          GoldenTemplate,
          AgentSession,
        ],
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: false,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    ClientsModule,
    ServersModule,
    AccessModule,
    TicketsModule,
    TintaCoreModule,
    ProvisioningModule,
  ],
  controllers: [AppController],
  providers: [
    // Apply ThrottlerGuard globally; override per-route with @Throttle() / @SkipThrottle()
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
