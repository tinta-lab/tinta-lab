import {
  Injectable,
  Optional,
  Inject,
  forwardRef,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository } from 'typeorm';
import { AccessLog } from './entities/access-log.entity';
import { AuditEventType } from './entities/audit-event.entity';
import { AuditLogService } from './audit-log.service';
import { ServersService } from '../servers/servers.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import { TintaAgentGateway } from '../tinta-core/tinta-agent.gateway';
import { AccessReason } from './enums/access-reason.enum';
import { ClientAccessLogViewDto } from './dto/client-access-log-view.dto';
import { AccessConnectResponseDto } from './dto/access-connect-response.dto';
import { AccessLogsQueryDto } from './dto/access-logs-query.dto';
import {
  AccessEventPageDto,
  AccessEventViewDto,
  AccessLogDetailDto,
} from './dto/access-event-view.dto';
import {
  AuditTrailEventViewDto,
  AuditChainVerificationDto,
} from './dto/audit-trail-view.dto';

const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_RETENTION_DAYS = 365;

// Raw pg row shapes for the hand-joined queries in queryAuditEvents() —
// dataSource.query() has no way to know the column set of an arbitrary SQL
// string, so these exist purely to stop the result from decaying to `any`
// and cascading unsafe-* lint errors through every field access below.
interface AuditEventRow {
  id: string;
  seq: string;
  eventType: AuditEventType;
  createdAt: Date;
  accessLogId: string;
  metadata: Record<string, unknown> | null;
  actorId: string | null;
  actorFirstName: string | null;
  actorLastName: string | null;
  serverId: string | null;
  serverName: string | null;
  clientUserId: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  ticketId: string | null;
  ticketSubject: string | null;
}

interface CountRow {
  count: number;
}

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
    @InjectDataSource()
    private dataSource: DataSource,
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

    await this.auditLog.append(
      saved.id,
      AuditEventType.GRANTED,
      grantedByUserId,
      {
        serverId,
        durationMinutes: timeoutMinutes,
        reasonCode: options.reasonCode ?? null,
        reasonDetails: options.reasonDetails ?? null,
        ticketId: options.ticketId ?? null,
        ...(options.source ? { source: options.source } : {}),
      },
    );

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
      {
        isRevoked: true,
        revokedAt: new Date(),
        supportPassword: null as unknown as string,
      },
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
  ): Promise<AccessConnectResponseDto> {
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

    return { supportPassword: result.supportPassword ?? null };
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

  async getLogsForServer(
    serverId: string,
  ): Promise<Omit<AccessLog, 'supportPassword'>[]> {
    const logs = await this.accessLogRepository.find({
      where: { server: { id: serverId } },
      relations: ['grantedBy', 'accessedBy', 'ticket'],
      order: { createdAt: 'DESC' },
    });
    return logs.map(({ supportPassword: _pw, ...log }) => log as AccessLog);
  }

  // Returns a shaped, safe view — never the raw entities. See
  // ClientAccessLogViewDto for exactly why (Ticket.internalNotes and
  // Server.tunnelToken/cfAccessAppId/cfDnsRecordId must never reach a
  // client response, and this codebase has no serializer layer that would
  // strip them automatically).
  // ticketId, when given, scopes to one ticket's access history instead of
  // the client's last 20 overall — used by the ticket detail page. Ownership
  // is enforced by the join itself (server.client.id = clientId AND
  // ticket.id = ticketId): a ticketId that's nonexistent or belongs to
  // another client simply matches no rows, same shape as "no history yet"
  // — no separate existence check, so there's nothing to distinguish "not
  // yours" from "doesn't exist" from "empty". Uncapped in this mode (a
  // single ticket's history won't run away the way "all of a client's
  // access ever" could), unlike the unscoped `take: 20`.
  async getLogsForClient(
    clientId: string,
    ticketId?: string,
  ): Promise<ClientAccessLogViewDto[]> {
    const logs = await this.accessLogRepository.find({
      where: {
        server: { client: { id: clientId } },
        ...(ticketId ? { ticket: { id: ticketId } } : {}),
      },
      relations: ['grantedBy', 'accessedBy', 'server', 'ticket'],
      order: { createdAt: 'DESC' },
      ...(ticketId ? {} : { take: 20 }),
    });
    return logs.map((log) => ({
      id: log.id,
      grantedAt: log.grantedAt,
      expiresAt: log.expiresAt,
      connectedAt: log.connectedAt,
      revokedAt: log.revokedAt,
      isRevoked: log.isRevoked,
      reason: log.reason,
      reasonCode: log.reasonCode,
      reasonDetails: log.reasonDetails,
      activityLog: log.activityLog,
      grantedBy: log.grantedBy
        ? {
            firstName: log.grantedBy.firstName,
            lastName: log.grantedBy.lastName,
          }
        : null,
      accessedBy: log.accessedBy
        ? {
            firstName: log.accessedBy.firstName,
            lastName: log.accessedBy.lastName,
          }
        : null,
      server: log.server ? { id: log.server.id, name: log.server.name } : null,
      ticket: log.ticket
        ? {
            id: log.ticket.id,
            subject: log.ticket.subject,
            status: log.ticket.status,
          }
        : null,
    }));
  }

  async getAuditTrail(
    accessLogId: string,
  ): Promise<AuditTrailEventViewDto[]> {
    const events = await this.auditLog.getEventsForAccessLog(accessLogId);
    return events.map((e) => ({
      id: e.id,
      seq: e.seq,
      accessLogId: e.accessLogId,
      eventType: e.eventType,
      actorUserId: e.actorUserId,
      metadata: e.metadata,
      createdAt: e.createdAt,
      prevHash: e.prevHash,
      hash: e.hash,
    }));
  }

  async verifyAuditChain(): Promise<AuditChainVerificationDto> {
    return this.auditLog.verifyChain();
  }

  // Event-level browsing for GET /access/logs — audit_events is the primary
  // dataset (one row per GRANTED/CONNECTED/REVOKED/EXPIRED/... event), not
  // access_logs, so eventType filters map onto a real column instead of a
  // derived session status. access_logs/servers/clients/tickets are joined
  // in only for display context.
  //
  // `staffTicketScopeUserId`, when set, restricts results to events whose
  // access_log is linked to a ticket that user posted a message on (public
  // reply or internal note) — this is how STAFF (SUPPORT/SALES) callers are
  // scoped. It is NEVER derived from `filter.staffId`: the controller only
  // forwards that query field through for ADMIN callers, who may use it to
  // filter *by* a staff member's actorUserId — a different thing entirely.
  async queryAuditEvents(
    filter: AccessLogsQueryDto,
    staffTicketScopeUserId?: string,
  ): Promise<AccessEventPageDto> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    const push = (sql: string, value: unknown) => {
      params.push(value);
      conditions.push(sql.replace('?', `$${params.length}`));
    };

    if (filter.serverId) push('al."serverId" = ?', filter.serverId);
    if (filter.clientId) push('c.id = ?', filter.clientId);
    if (filter.staffId) push('ae."actorUserId" = ?', filter.staffId);
    if (filter.ticketId) push('al."ticketId" = ?', filter.ticketId);
    if (filter.eventType) push('ae."eventType" = ?', filter.eventType);
    if (filter.dateFrom) push('ae."createdAt" >= ?', new Date(filter.dateFrom));
    if (filter.dateTo) push('ae."createdAt" <= ?', new Date(filter.dateTo));
    if (staffTicketScopeUserId) {
      push(
        'al."ticketId" IN (SELECT DISTINCT "ticketId" FROM ticket_messages WHERE "authorId" = ?)',
        staffTicketScopeUserId,
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const take = Math.min(filter.take ?? 50, 100);
    const skip = filter.skip ?? 0;

    const dataSql = `
      SELECT
        ae.id, ae.seq, ae."eventType", ae."createdAt", ae."accessLogId", ae.metadata,
        actor.id AS "actorId", actor."firstName" AS "actorFirstName", actor."lastName" AS "actorLastName",
        s.id AS "serverId", s.name AS "serverName",
        cu.id AS "clientUserId", cu."firstName" AS "clientFirstName", cu."lastName" AS "clientLastName",
        t.id AS "ticketId", t.subject AS "ticketSubject"
      FROM audit_events ae
      LEFT JOIN access_logs al ON al.id = ae."accessLogId"
      LEFT JOIN users actor ON actor.id = ae."actorUserId"
      LEFT JOIN servers s ON s.id = al."serverId"
      LEFT JOIN clients c ON c.id = s."clientId"
      LEFT JOIN users cu ON cu.id = c."userId"
      LEFT JOIN tickets t ON t.id = al."ticketId"
      ${where}
      ORDER BY ae.seq DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const countSql = `
      SELECT count(*)::int AS count
      FROM audit_events ae
      LEFT JOIN access_logs al ON al.id = ae."accessLogId"
      LEFT JOIN servers s ON s.id = al."serverId"
      LEFT JOIN clients c ON c.id = s."clientId"
      ${where}
    `;

    const [rows, countRows] = await Promise.all([
      this.dataSource.query<AuditEventRow[]>(dataSql, [...params, take, skip]),
      this.dataSource.query<CountRow[]>(countSql, params),
    ]);

    const data: AccessEventViewDto[] = rows.map((r) => ({
      id: r.id,
      seq: r.seq,
      eventType: r.eventType,
      createdAt: r.createdAt,
      accessLogId: r.accessLogId,
      metadata: r.metadata,
      // firstName/lastName/name are NOT NULL columns — when the join key
      // (actorId/clientUserId/serverId) is present the joined row was found,
      // so these are never really null; `?? ''` just keeps that guarantee
      // honest to the type checker without asserting past a LEFT JOIN.
      actor: r.actorId
        ? {
            id: r.actorId,
            firstName: r.actorFirstName ?? '',
            lastName: r.actorLastName ?? '',
          }
        : null,
      server: r.serverId ? { id: r.serverId, name: r.serverName ?? '' } : null,
      client: r.clientUserId
        ? {
            id: r.clientUserId,
            firstName: r.clientFirstName ?? '',
            lastName: r.clientLastName ?? '',
          }
        : null,
      ticket: r.ticketId
        ? { id: r.ticketId, subject: r.ticketSubject ?? '' }
        : null,
    }));

    return { data, total: countRows[0]?.count ?? 0 };
  }

  // Session-level drill-down for GET /access/logs/:accessLogId. Existence is
  // checked before scope (404 for a genuinely unknown id, 403 for a real
  // session outside the caller's staff scope) — unlike the CLIENT-facing
  // ticket endpoints, there's no existence-hiding concern for staff callers.
  async getAccessLogDetail(
    accessLogId: string,
    staffTicketScopeUserId?: string,
  ): Promise<AccessLogDetailDto> {
    const log = await this.accessLogRepository.findOne({
      where: { id: accessLogId },
      relations: [
        'grantedBy',
        'accessedBy',
        'server',
        'server.client',
        'server.client.user',
        'ticket',
      ],
    });
    if (!log) throw new NotFoundException('Access log not found');

    if (staffTicketScopeUserId) {
      const ticketId = log.ticket?.id;
      const allowed = ticketId
        ? await this.dataSource.query<unknown[]>(
            'SELECT 1 FROM ticket_messages WHERE "ticketId" = $1 AND "authorId" = $2 LIMIT 1',
            [ticketId, staffTicketScopeUserId],
          )
        : [];
      if (!allowed.length) {
        throw new ForbiddenException(
          'This access log is outside your ticket scope',
        );
      }
    }

    const events = await this.auditLog.getEventsForAccessLog(accessLogId);
    const clientUser = log.server?.client?.user;

    return {
      id: log.id,
      grantedAt: log.grantedAt,
      expiresAt: log.expiresAt,
      connectedAt: log.connectedAt,
      revokedAt: log.revokedAt,
      isRevoked: log.isRevoked,
      reasonCode: log.reasonCode,
      reasonDetails: log.reasonDetails,
      reason: log.reason,
      grantedBy: log.grantedBy
        ? {
            id: log.grantedBy.id,
            firstName: log.grantedBy.firstName,
            lastName: log.grantedBy.lastName,
          }
        : null,
      accessedBy: log.accessedBy
        ? {
            id: log.accessedBy.id,
            firstName: log.accessedBy.firstName,
            lastName: log.accessedBy.lastName,
          }
        : null,
      server: log.server ? { id: log.server.id, name: log.server.name } : null,
      client: clientUser
        ? {
            id: log.server.client.id,
            firstName: clientUser.firstName,
            lastName: clientUser.lastName,
          }
        : null,
      ticket: log.ticket
        ? { id: log.ticket.id, subject: log.ticket.subject }
        : null,
      events: events.map((e) => ({
        id: e.id,
        seq: e.seq,
        eventType: e.eventType,
        actorUserId: e.actorUserId,
        metadata: e.metadata,
        createdAt: e.createdAt,
      })),
    };
  }
}
