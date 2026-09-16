import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server } from '../servers/entities/server.entity';
import { AgentSession } from '../tinta-core/entities/agent-session.entity';
import { ConfigService } from '@nestjs/config';
import { TintaAgentGateway } from '../tinta-core/tinta-agent.gateway';
import { HubAgentViewDto, HubViewDto } from './dto/hub-view.dto';

@Injectable()
export class HubsService {
  constructor(
    @InjectRepository(Server)
    private readonly serverRepo: Repository<Server>,
    @InjectRepository(AgentSession)
    private readonly sessionRepo: Repository<AgentSession>,
    private readonly config: ConfigService,
    private readonly gateway: TintaAgentGateway,
  ) {}

  private publicUrl(server: Server): string | null {
    if (!server.hubId) return null;
    const base = this.config.get('CLOUDFLARE_BASE_DOMAIN', 'tinta-lab.de');
    return `https://hub-${server.hubId}.${base}`;
  }

  private mapSession(
    session: AgentSession | undefined,
    clientId: string,
  ): HubAgentViewDto | null {
    if (!session) return null;
    return {
      agentVersion: session.agentVersion ?? null,
      metrics: session.metrics
        ? {
            cpuPercent: session.metrics.cpuPercent,
            memPercent: session.metrics.memPercent,
            diskPercent: session.metrics.diskPercent,
            deviceCount: session.metrics.deviceCount,
            automationCount: session.metrics.automationCount,
          }
        : null,
      lastConnectedAt: session.lastConnectedAt ?? null,
      lastTokenMismatchAt: session.lastTokenMismatchAt ?? null,
      installToken: session.installToken ?? null,
      installTokenExpiresAt: session.installTokenExpiresAt ?? null,
      isOnline: this.gateway.isConnected(clientId),
      appliedTemplates: session.appliedTemplates ?? [],
    };
  }

  private toHubView(
    srv: Server,
    session: AgentSession | undefined,
  ): HubViewDto {
    return {
      id: srv.id,
      name: srv.name,
      hubId: srv.hubId ?? null,
      publicUrl: this.publicUrl(srv),
      localUrl: srv.localUrl ?? null,
      haVersion: srv.haVersion ?? null,
      accessEnabled: srv.accessEnabled,
      accessExpiresAt: srv.accessExpiresAt ?? null,
      lastSeenAt: srv.lastSeenAt ?? null,
      tunnelId: srv.tunnelId ?? null,
      client: {
        id: srv.client.id,
        phone: srv.client.phone ?? null,
        city: srv.client.city ?? null,
        user: {
          firstName: srv.client.user.firstName,
          lastName: srv.client.user.lastName,
          email: srv.client.user.email,
        },
      },
      agent: this.mapSession(session, srv.client.id),
    };
  }

  // skip/take are opt-in — see common/dto/pagination.dto.ts. Only paginates
  // the servers query; sessions stay a full fetch since it's one row per
  // client either way and is needed in full to build the lookup map.
  async findAll(skip?: number, take?: number): Promise<HubViewDto[]> {
    const [servers, sessions] = await Promise.all([
      this.serverRepo.find({
        relations: ['client', 'client.user'],
        ...(skip !== undefined ? { skip } : {}),
        ...(take !== undefined ? { take } : {}),
        order: { createdAt: 'DESC' },
      }),
      this.sessionRepo.find({ relations: ['client'] }),
    ]);

    const sessionByClientId = new Map(sessions.map((s) => [s.clientId, s]));

    return servers.map((srv) =>
      this.toHubView(srv, sessionByClientId.get(srv.client.id)),
    );
  }

  async findOne(serverId: string): Promise<HubViewDto | null> {
    const srv = await this.serverRepo.findOne({
      where: { id: serverId },
      relations: ['client', 'client.user'],
    });
    if (!srv) return null;

    const session = await this.sessionRepo.findOne({
      where: { clientId: srv.client.id },
    });

    return this.toHubView(srv, session ?? undefined);
  }
}
