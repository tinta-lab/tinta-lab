import { Injectable, Optional, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessLog } from './entities/access-log.entity';
import { ServersService } from '../servers/servers.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AccessService {
  constructor(
    @InjectRepository(AccessLog)
    private accessLogRepository: Repository<AccessLog>,
    private serversService: ServersService,
    private configService: ConfigService,
    @Optional() private notifications: NotificationsService,
  ) {}

  // Throws ForbiddenException if the server does not belong to the given user
  async assertOwnership(serverId: string, userId: string): Promise<void> {
    const server = await this.serversService.findById(serverId);
    if (server.client?.user?.id !== userId) {
      throw new ForbiddenException('Server does not belong to this account');
    }
  }

  async grantAccess(serverId: string, grantedByUserId: string): Promise<AccessLog> {
    const timeoutMinutes = this.configService.get<number>('SUPPORT_ACCESS_TIMEOUT', 60);
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

    await this.serversService.setAccessEnabled(serverId, true, expiresAt);

    const server = await this.serversService.findById(serverId);
    const log = this.accessLogRepository.create({
      server: { id: serverId } as any,
      grantedBy: { id: grantedByUserId } as any,
      grantedAt: new Date(),
      expiresAt,
    });
    const saved = await this.accessLogRepository.save(log);

    // Telegram: notify support team
    if (server.client?.user) {
      this.notifications?.notifyAccessGranted({
        clientName: `${server.client.user.firstName} ${server.client.user.lastName}`,
        clientEmail: server.client.user.email,
        serverName: server.name,
        serverUrl: server.localUrl || `https://${server.subdomain}`,
        expiresAt,
      }).catch(() => {});
    }

    return saved;
  }

  async revokeAccess(serverId: string, reason: 'manual' | 'expired' = 'manual'): Promise<void> {
    await this.serversService.setAccessEnabled(serverId, false);
    await this.accessLogRepository.update(
      { server: { id: serverId }, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() },
    );

    // Telegram: notify support team
    try {
      const server = await this.serversService.findById(serverId);
      if (server.client?.user) {
        this.notifications?.notifyAccessRevoked({
          clientName: `${server.client.user.firstName} ${server.client.user.lastName}`,
          serverName: server.name,
          reason,
        }).catch(() => {});
      }
    } catch { /* server may already be deleted */ }
  }

  async recordConnection(serverId: string, supportUserId: string): Promise<void> {
    await this.accessLogRepository.update(
      { server: { id: serverId }, isRevoked: false },
      {
        accessedBy: { id: supportUserId } as any,
        connectedAt: new Date(),
      },
    );
  }

  async checkAndRevokeExpired(): Promise<void> {
    const servers = await this.serversService.findAll();
    const now = new Date();
    for (const server of servers) {
      if (server.accessEnabled && server.accessExpiresAt && server.accessExpiresAt < now) {
        await this.revokeAccess(server.id, 'expired');
      }
    }
  }

  async getLogsForServer(serverId: string): Promise<AccessLog[]> {
    return this.accessLogRepository.find({
      where: { server: { id: serverId } },
      relations: ['grantedBy', 'accessedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getLogsForClient(clientId: string): Promise<AccessLog[]> {
    return this.accessLogRepository.find({
      where: { server: { client: { id: clientId } } },
      relations: ['grantedBy', 'accessedBy', 'server'],
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }
}
