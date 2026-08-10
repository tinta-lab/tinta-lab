import {
  Injectable,
  Optional,
  Inject,
  forwardRef,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AccessLog } from './entities/access-log.entity';
import { AuditEventType } from './entities/audit-event.entity';
import { AuditLogService } from './audit-log.service';
import { ServersService } from '../servers/servers.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import { TintaAgentGateway } from '../tinta-core/tinta-agent.gateway';
import { AccessReason } from './enums/access-reason.enum';

const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_RETENTION_DAYS = 365;

export interface GrantAccessOptions {
  // Closed reason set — see enums/access-reason.enum.ts. reasonDetails is
  // only meaningful (and should only be set) when reasonCode === OTHER.
  reasonCode?: AccessReason;
  reasonDetails?: string;
  ticketId?: string;
  durationMinutes?: number;
  // Tags the audit event with where the grant originated — the REST path
  // leaves this unset; the HA `input_boolean` toggle path passes 'ha_toggle'.
  source?: string;
}

@Injectable()
export class AccessService {
  constructor(
    @InjectRepository(AccessLog)
    private accessLogRepository: Repository<AccessLog>,
    private serversService: ServersService,
    private configService: ConfigService,
    private auditLog: AuditLogService,
    @Optional() private notifications: NotificationsService,
    @Optional()
    @Inject(forwardRef(() => TintaAgentGateway))
    private agentGateway: TintaAgentGateway,
  ) {}

  // Throws ForbiddenException if the server does not belong to the given user
  async assertOwnership(serverId: string, userId: string): Promise<void> {
    const server = await this.serversService.findById(serverId);
    if (server.client?.user?.id !== userId) {
      throw new ForbiddenException('Server does not belong to this account');
    }
  }

  async grantAccess(
    serverId: string,
    grantedByUserId: string,
    options: GrantAccessOptions = {},
  ): Promise<AccessLog> {
    const timeoutMinutes =
      options.durationMinutes ??
      this.configService.get<number>(
        'SUPPORT_ACCESS_TIMEOUT',
        DEFAULT_DURATION_MINUTES,
      );
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

    const supportPassword = randomBytes(9).toString('base64url'); // 12-char URL-safe random

    await this.serversService.setAccessEnabled(serverId, true, expiresAt);

    const server = await this.serversService.findById(serverId);
    const log = this.accessLogRepository.create({
      server: { id: serverId } as any,
      grantedBy: { id: grantedByUserId } as any,
      grantedAt: new Date(),
      expiresAt,
      supportPassword,
      reasonCode: options.reasonCode ?? null,
      reasonDetails: options.reasonDetails ?? null,
      ...(options.ticketId ? { ticket: { id: options.ticketId } as any } : {}),
    });
    const saved = await this.accessLogRepository.save(log);

    await this.auditLog.append(saved.id, AuditEventType.GRANTED, grantedByUserId, {
      serverId,
      durationMinutes: timeoutMinutes,
      reasonCode: options.reasonCode ?? null,
      reasonDetails: options.reasonDetails ?? null,
      ticketId: options.ticketId ?? null,
      ...(options.source ? { source: options.source } : {}),
    });

    // Enable tinta-support user with fresh password on the client's HA
    this.agentGateway?.setSupportAccess(
      server.client?.id,
      true,
      supportPassword,
      saved.grantedAt.toISOString(),
      saved.id,
      saved.expiresAt.toISOString(),
    );

    // Telegram: notify support team
    if (server.client?.user) {
      this.notifications
        ?.notifyAccessGranted({
          clientName: `${server.client.user.firstName} ${server.client.user.lastName}`,
          clientEmail: server.client.user.email,
          serverName: server.name,
          serverUrl: server.localUrl || `https://${server.subdomain}`,
          expiresAt,
        })
        .catch(() => {});
    }

    return saved;
  }

  async revokeAccess(
    serverId: string,
    reason: 'manual' | 'expired' = 'manual',
    revokedByUserId?: string,
    source?: string,
  ): Promise<void> {
    // Capture active log BEFORE marking as revoked (needed for activity log fetch)
    const activeLog = await this.accessLogRepository.findOne({
      where: { server: { id: serverId }, isRevoked: false },
      order: { grantedAt: 'DESC' },
    });

    await this.serversService.setAccessEnabled(serverId, false);
    await this.accessLogRepository.update(
      { server: { id: serverId }, isRevoked: false },
      { isRevoked: true, revokedAt: new Date(), supportPassword: null as unknown as string },
    );

    if (activeLog) {
      await this.auditLog.append(
        activeLog.id,
        reason === 'expired' ? AuditEventType.EXPIRED : AuditEventType.REVOKED,
        revokedByUserId ?? null,
        { reason, ...(source ? { source } : {}) },
      );
    }

    // Disable tinta-support user, scramble password, request activity log from agent
    try {
      const serverForAccess = await this.serversService.findById(serverId);
      const scramble = randomBytes(16).toString('hex');
      this.agentGateway?.setSupportAccess(
        serverForAccess.client?.id,
        false,
        scramble,
        activeLog?.grantedAt?.toISOString(),
        activeLog?.id,
      );
    } catch {
      /* agent may be offline */
    }

    // Telegram: notify support team
    try {
      const server = await this.serversService.findById(serverId);
      if (server.client?.user) {
        this.notifications
          ?.notifyAccessRevoked({
            clientName: `${server.client.user.firstName} ${server.client.user.lastName}`,
            serverName: server.name,
            reason,
          })
          .catch(() => {});
      }
    } catch {
      /* server may already be deleted */
    }
  }

  // Binds the session to exactly one support employee. Rejects a second
  // employee trying to grab the same active session's credentials.
  async recordConnection(
    serverId: string,
    supportUserId: string,
  ): Promise<AccessLog> {
    const activeLog = await this.accessLogRepository.findOne({
      where: { server: { id: serverId }, isRevoked: false },
      relations: ['accessedBy'],
      order: { grantedAt: 'DESC' },
    });
    if (!activeLog) {
      throw new ForbiddenException('No active support session for this server');
    }
    if (activeLog.accessedBy && activeLog.accessedBy.id !== supportUserId) {
      throw new ConflictException(
        `Session already claimed by ${activeLog.accessedBy.firstName} ${activeLog.accessedBy.lastName}`,
      );
    }

    const isFirstConnect = !activeLog.connectedAt;

    if (isFirstConnect) {
      await this.accessLogRepository.update(
        { id: activeLog.id },
        { accessedBy: { id: supportUserId } as any, connectedAt: new Date() },
      );
      await this.auditLog.append(
        activeLog.id,
        AuditEventType.CONNECTED,
        supportUserId,
        {},
      );
    }

    const result = (await this.getActiveAccessForServer(serverId)) as AccessLog;

    // Update the in-HA banner with the connected employee's name
    if (isFirstConnect && result.accessedBy) {
      const server = await this.serversService.findById(serverId);
      if (server.client?.id) {
        this.agentGateway?.notifySupportConnected(
          server.client.id,
          `${result.accessedBy.firstName} ${result.accessedBy.lastName}`,
          activeLog.expiresAt?.toISOString(),
        );
      }
    }

    return result;
  }

  async setRetentionHold(id: string, hold: boolean): Promise<void> {
    await this.accessLogRepository.update({ id }, { retentionHold: hold });
  }

  // GDPR retention: purge closed sessions older than the retention window.
  // Skips anything still open or explicitly held (litigation/incident).
  async purgeExpiredLogs(): Promise<number> {
    const retentionDays = this.configService.get<number>(
      'AUDIT_LOG_RETENTION_DAYS',
      DEFAULT_RETENTION_DAYS,
    );
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const result = await this.accessLogRepository.delete({
      isRevoked: true,
      retentionHold: false,
      createdAt: LessThan(cutoff),
    });
    return result.affected ?? 0;
  }

  async checkAndRevokeExpired(): Promise<void> {
    const servers = await this.serversService.findAll();
    const now = new Date();
    for (const server of servers) {
      if (
        server.accessEnabled &&
        server.accessExpiresAt &&
        server.accessExpiresAt < now
      ) {
        await this.revokeAccess(server.id, 'expired');
      }
    }
  }

  async getActiveAccessForServer(serverId: string): Promise<AccessLog | null> {
    return this.accessLogRepository.findOne({
      where: { server: { id: serverId }, isRevoked: false },
      relations: ['accessedBy'],
      order: { grantedAt: 'DESC' },
    });
  }

  async getLogsForServer(serverId: string): Promise<Omit<AccessLog, 'supportPassword'>[]> {
    const logs = await this.accessLogRepository.find({
      where: { server: { id: serverId } },
      relations: ['grantedBy', 'accessedBy', 'ticket'],
      order: { createdAt: 'DESC' },
    });
    return logs.map(({ supportPassword: _pw, ...log }) => log as AccessLog);
  }

  async getLogsForClient(clientId: string): Promise<Omit<AccessLog, 'supportPassword'>[]> {
    const logs = await this.accessLogRepository.find({
      where: { server: { client: { id: clientId } } },
      relations: ['grantedBy', 'accessedBy', 'server', 'ticket'],
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return logs.map(({ supportPassword: _pw, ...log }) => log as AccessLog);
  }

  async getAuditTrail(accessLogId: string) {
    return this.auditLog.getEventsForAccessLog(accessLogId);
  }

  async verifyAuditChain() {
    return this.auditLog.verifyChain();
  }
}
