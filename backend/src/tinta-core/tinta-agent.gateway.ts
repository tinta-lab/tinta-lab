import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentSession, AgentStatus } from './entities/agent-session.entity';
import { TintaCommand } from './tinta-command.types';
import { AccessLog } from '../access/entities/access-log.entity';
import { AuditEventType } from '../access/entities/audit-event.entity';
import { AuditLogService } from '../access/audit-log.service';
import { AccessService } from '../access/access.service';
import { AccessReason } from '../access/enums/access-reason.enum';
import { ServersService } from '../servers/servers.service';
import { ServerStatus } from '../servers/entities/server.entity';
import { GoldenTemplateService } from './golden-template.service';

interface AgentRegisterPayload {
  clientId: string;
  jwt: string;
  agentVersion?: string;
  haVersion?: string;
}

@WebSocketGateway({
  namespace: '/tinta/ws',
  cors: { origin: process.env.FRONTEND_URL ?? false },
})
export class TintaAgentGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TintaAgentGateway.name);
  // clientId → socket
  private readonly agents = new Map<string, Socket>();

  constructor(
    @InjectRepository(AgentSession)
    private readonly sessionRepo: Repository<AgentSession>,
    @InjectRepository(AccessLog)
    private readonly accessLogRepo: Repository<AccessLog>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly serversService: ServersService,
    private readonly auditLog: AuditLogService,
    private readonly templateService: GoldenTemplateService,
    @Inject(forwardRef(() => AccessService))
    private readonly accessService: AccessService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Agent socket connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    // Find clientId by socket
    for (const [clientId, socket] of this.agents.entries()) {
      if (socket.id === client.id) {
        this.agents.delete(clientId);
        await this.sessionRepo.update(
          { clientId },
          { status: AgentStatus.DISCONNECTED },
        );
        const servers = await this.serversService.findByClientId(clientId);
        for (const srv of servers) {
          await this.serversService.updateStatus(srv.id, ServerStatus.OFFLINE);
        }
        this.logger.log(`Agent ${clientId} disconnected`);
        break;
      }
    }
  }

  @SubscribeMessage('register')
  async handleRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AgentRegisterPayload,
  ) {
    const { clientId, jwt, agentVersion, haVersion } = payload;

    // Validate JWT token
    try {
      const secret =
        this.config.get<string>('AGENT_JWT_SECRET') ??
        this.config.get<string>('JWT_SECRET') ??
        '';
      this.logger.debug(`Agent auth: clientId=${clientId}`);
      const decoded = this.jwtService.verify(jwt, { secret });
      if (decoded.sub !== clientId || decoded.type !== 'tinta-agent') {
        this.logger.warn(`Agent auth failed for ${clientId}: token mismatch`);
        client.emit('error', { message: 'Unauthorized' });
        client.disconnect();
        return { success: false, error: 'Unauthorized' };
      }
    } catch (err: any) {
      this.logger.warn(`Agent JWT invalid for ${clientId}: ${err.message}`);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
      return { success: false, error: 'Invalid token' };
    }

    // Require an existing AgentSession — rejects tokens for deleted/unknown clients
    const stored = await this.sessionRepo.findOne({ where: { clientId } });
    if (!stored) {
      this.logger.warn(`Agent registration rejected: no session for ${clientId}`);
      client.emit('error', { message: 'Unknown client' });
      client.disconnect();
      return { success: false, error: 'Unknown client' };
    }
    if (stored.agentToken && stored.agentToken !== jwt) {
      this.logger.warn(
        `Agent token mismatch for ${clientId} — recording and rejecting`,
      );
      await this.sessionRepo.update({ clientId }, { lastTokenMismatchAt: new Date() });
      client.emit('error', { message: 'Token revoked' });
      client.disconnect();
      return { success: false, error: 'Token revoked' };
    }

    // Bind clientId to socket data — used by heartbeat/metrics to avoid spoofing
    client.data.clientId = clientId;

    // Register in memory
    this.agents.set(clientId, client);

    // Update session in DB
    const existing = await this.sessionRepo.findOne({ where: { clientId } });
    if (!existing) {
      const newSession = this.sessionRepo.create({
        clientId,
        client: { id: clientId } as any,
        status: AgentStatus.CONNECTED,
        agentVersion: agentVersion ?? null,
        haVersion: haVersion ?? null,
        lastConnectedAt: new Date(),
        lastHeartbeatAt: new Date(),
      } as any);
      await this.sessionRepo.save(newSession as any);
    } else {
      await this.sessionRepo.update(
        { clientId },
        {
          status: AgentStatus.CONNECTED,
          lastConnectedAt: new Date(),
          lastHeartbeatAt: new Date(),
          ...(agentVersion ? { agentVersion } : {}),
          ...(haVersion ? { haVersion } : {}),
        },
      );
    }

    // Update server status to online and resync active support access
    const servers = await this.serversService.findByClientId(clientId);
    for (const srv of servers) {
      await this.serversService.heartbeat(srv.id, haVersion);

      // If support access is currently active, resend it so the agent doesn't miss it
      if (srv.accessEnabled) {
        const activeLog = await this.accessLogRepo.findOne({
          where: { server: { id: srv.id }, isRevoked: false },
          order: { grantedAt: 'DESC' },
        });
        if (activeLog?.supportPassword) {
          client.emit('set_support_access', {
            enabled: true,
            password: activeLog.supportPassword,
            grantedAt: activeLog.grantedAt?.toISOString(),
            accessLogId: activeLog.id,
            expiresAt: activeLog.expiresAt?.toISOString(),
          });
          this.logger.log(`Resynced active support access → agent ${clientId}`);
        }
      }
    }

    // Consume install token — single-use, cleared once agent successfully connects
    if (stored.installToken) {
      await this.sessionRepo.update({ clientId }, { installToken: null, installTokenExpiresAt: null });
    }

    // Apply any default golden templates that couldn't be pushed at
    // provisioning time because the agent wasn't connected yet.
    const appliedAlready = new Set(stored.appliedTemplates ?? []);
    const defaultTemplates = await this.templateService.findAll();
    for (const template of defaultTemplates) {
      if (appliedAlready.has(template.slug)) continue;
      const sent = await this.applyTemplate(clientId, {
        slug: template.slug,
        name: template.name,
        automation: template.automation,
      });
      if (sent) {
        await this.templateService.markApplied(clientId, template.slug);
        this.logger.log(`Applied default template ${template.slug} → agent ${clientId}`);
      }
    }

    this.logger.log(
      `Agent registered: ${clientId} (v${agentVersion ?? '?'}, HA ${haVersion ?? '?'})`,
    );
    return { success: true };
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    // clientId is taken from socket.data (set during register) — prevents spoofing
    const clientId = client.data.clientId as string | undefined;
    if (!clientId) return { ok: false };

    await this.sessionRepo.update(
      { clientId },
      { lastHeartbeatAt: new Date(), status: AgentStatus.CONNECTED },
    );
    return { ok: true };
  }

  @SubscribeMessage('metrics')
  async handleMetrics(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      cpuPercent: number;
      memPercent: number;
      diskPercent: number;
      deviceCount: number;
      automationCount: number;
      uptimeSeconds: number;
    },
  ) {
    const clientId = client.data.clientId as string | undefined;
    if (!clientId) return;

    await this.sessionRepo.update({ clientId }, { metrics: payload } as any);
  }

  @SubscribeMessage('state_update')
  async handleStateUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { entities: Record<string, any> },
  ) {
    // Reserved for a future live control dashboard. Only controllable entities
    // (light/climate/switch/cover/security) reach this point — the agent never
    // forwards raw sensor/binary_sensor state (see tinta_agent/src/entities.ts).
    const clientId = client.data.clientId as string | undefined;
    if (!clientId) return;
  }

  // Forcefully disconnect a running agent (called on token rotation)
  disconnectAgent(clientId: string, reason = 'Disconnected by server'): void {
    const socket = this.agents.get(clientId);
    if (socket) {
      socket.emit('reconnect_required', { reason });
      socket.disconnect();
      this.agents.delete(clientId);
      this.logger.log(`Agent ${clientId} force-disconnected: ${reason}`);
    }
  }

  // Called from TintaCoreService to send a command to an agent
  async executeCommand(
    clientId: string,
    command: TintaCommand,
  ): Promise<boolean> {
    const socket = this.agents.get(clientId);
    if (!socket) {
      this.logger.warn(`Agent ${clientId} not connected`);
      return false;
    }
    socket.emit('command', command);
    this.logger.log(
      `Command sent to ${clientId}: ${command.entityType}.${command.action}`,
    );
    return true;
  }

  // Apply golden template to a connected agent
  async applyTemplate(
    clientId: string,
    template: Record<string, any>,
  ): Promise<boolean> {
    const socket = this.agents.get(clientId);
    if (!socket) return false;
    socket.emit('apply_template', template);
    return true;
  }

  // Enable or disable the tinta-support HA user on the agent's Home Assistant
  setSupportAccess(
    clientId: string,
    enabled: boolean,
    password?: string,
    grantedAt?: string,
    accessLogId?: string,
    expiresAt?: string,
  ): void {
    const socket = this.agents.get(clientId);
    if (socket) {
      socket.emit('set_support_access', {
        enabled,
        password,
        grantedAt,
        accessLogId,
        expiresAt,
      });
      this.logger.log(
        `Support access ${enabled ? 'ENABLED' : 'DISABLED'} → agent ${clientId}`,
      );
    }
  }

  // Tells the agent who actually connected, so the in-HA banner can name them
  notifySupportConnected(
    clientId: string,
    accessedByName: string,
    expiresAt?: string,
  ): void {
    const socket = this.agents.get(clientId);
    if (socket) {
      socket.emit('support_connected', { accessedByName, expiresAt });
      this.logger.log(`Support connected notice → agent ${clientId}`);
    }
  }

  // Client toggled support access from their HA dashboard / phone
  @SubscribeMessage('access_toggle')
  async handleAccessToggle(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { enabled: boolean },
  ) {
    const clientId = client.data.clientId as string | undefined;
    if (!clientId) return;

    // Grant/revoke logic lives in AccessService — the REST-triggered path
    // (dashboard) and this HA-toggle path used to duplicate it independently,
    // which had already drifted once (see git history). AccessService pushes
    // `set_support_access` to this same agent socket itself (via
    // `agentGateway.setSupportAccess`, looked up by clientId), so this
    // handler doesn't emit anything back to `client` directly for the
    // grant/revoke cases — only the resync branch does, since that's not a
    // state change AccessService has any reason to know about.
    const servers = await this.serversService.findByClientId(clientId);
    for (const srv of servers) {
      if (payload.enabled) {
        if (srv.accessEnabled) {
          // Already active — resync credentials so agent can (re)create HA user
          const active = await this.accessLogRepo.findOne({
            where: { server: { id: srv.id }, isRevoked: false },
            order: { grantedAt: 'DESC' },
          });
          if (active?.supportPassword) {
            client.emit('set_support_access', {
              enabled: true,
              password: active.supportPassword,
              grantedAt: active.grantedAt?.toISOString(),
              accessLogId: active.id,
              expiresAt: active.expiresAt?.toISOString(),
            });
          }
          continue;
        }

        const fullServer = await this.serversService.findById(srv.id);
        const grantedByUserId = fullServer.client?.user?.id;
        if (!grantedByUserId) {
          this.logger.warn(`Cannot grant via HA toggle — server ${srv.id} has no client user`);
          continue;
        }

        await this.accessService.grantAccess(srv.id, grantedByUserId, {
          reasonCode: AccessReason.HA_DASHBOARD_TOGGLE,
          source: 'ha_toggle',
        });
        this.logger.log(
          `Access GRANTED via HA toggle → ${clientId} server ${srv.id}`,
        );
      } else {
        if (!srv.accessEnabled) continue;

        await this.accessService.revokeAccess(srv.id, 'manual', undefined, 'ha_toggle');
        this.logger.log(
          `Access REVOKED via HA toggle → ${clientId} server ${srv.id}`,
        );
      }
    }
  }

  @SubscribeMessage('activity_log')
  async handleActivityLog(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { accessLogId: string; entries: string[] },
  ) {
    const clientId = client.data.clientId as string | undefined;
    if (!clientId || !payload?.accessLogId) return;
    await this.accessLogRepo.update({ id: payload.accessLogId }, {
      activityLog: payload.entries ?? [],
    } as any);
    await this.auditLog.append(
      payload.accessLogId,
      AuditEventType.ACTIVITY_LOG,
      null,
      { entryCount: payload.entries?.length ?? 0 },
    );
    this.logger.log(
      `Activity log stored for ${payload.accessLogId}: ${payload.entries?.length ?? 0} entries`,
    );
  }

  sendSelfUpdate(clientId: string, targetVersion: string): boolean {
    const socket = this.agents.get(clientId);
    if (!socket) return false;
    socket.emit('self_update', { targetVersion });
    this.logger.log(`Self-update v${targetVersion} → agent ${clientId}`);
    return true;
  }

  isConnected(clientId: string): boolean {
    return this.agents.has(clientId);
  }

  getConnectedAgents(): string[] {
    return Array.from(this.agents.keys());
  }
}
