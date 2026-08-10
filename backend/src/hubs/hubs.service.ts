import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server } from '../servers/entities/server.entity';
import { AgentSession } from '../tinta-core/entities/agent-session.entity';
import { ConfigService } from '@nestjs/config';
import { TintaAgentGateway } from '../tinta-core/tinta-agent.gateway';

export interface Hub {
  id: string;
  name: string;
  subdomain: string;
  hubId: string | null;
  publicUrl: string | null;
  localUrl: string | null;
  status: string;
  haVersion: string | null;
  accessEnabled: boolean;
  accessExpiresAt: Date | null;
  lastSeenAt: Date | null;
  tunnelId: string | null;
  cfAccessAppId: string | null;
  client: {
    id: string;
    phone: string | null;
    city: string | null;
    user: { id: string; firstName: string; lastName: string; email: string };
  };
  agent: {
    status: string;
    agentVersion: string | null;
    metrics: Record<string, any> | null;
    lastConnectedAt: Date | null;
    lastHeartbeatAt: Date | null;
    lastTokenMismatchAt: Date | null;
    installToken: string | null;
    installTokenExpiresAt: Date | null;
    isOnline: boolean;
  } | null;
}

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

  private mapSession(session: AgentSession | undefined, clientId: string): Hub['agent'] {
    if (!session) return null;
    return {
      status: session.status,
      agentVersion: session.agentVersion ?? null,
      metrics: session.metrics ?? null,
      lastConnectedAt: session.lastConnectedAt ?? null,
      lastHeartbeatAt: session.lastHeartbeatAt ?? null,
      lastTokenMismatchAt: (session as any).lastTokenMismatchAt ?? null,
      installToken: session.installToken ?? null,
      installTokenExpiresAt: session.installTokenExpiresAt ?? null,
      isOnline: this.gateway.isConnected(clientId),
    };
  }

  async findAll(): Promise<Hub[]> {
    const [servers, sessions] = await Promise.all([
      this.serverRepo.find({ relations: ['client', 'client.user'] }),
      this.sessionRepo.find({ relations: ['client'] }),
    ]);

    const sessionByClientId = new Map(sessions.map(s => [s.clientId, s]));

    return servers.map(srv => ({
      id: srv.id,
      name: srv.name,
      subdomain: srv.subdomain,
      hubId: srv.hubId ?? null,
      publicUrl: this.publicUrl(srv),
      localUrl: srv.localUrl ?? null,
      status: srv.status,
      haVersion: srv.haVersion ?? null,
      accessEnabled: srv.accessEnabled,
      accessExpiresAt: srv.accessExpiresAt ?? null,
      lastSeenAt: srv.lastSeenAt ?? null,
      tunnelId: srv.tunnelId ?? null,
      cfAccessAppId: srv.cfAccessAppId ?? null,
      client: {
        id: srv.client.id,
        phone: (srv.client as any).phone ?? null,
        city: (srv.client as any).city ?? null,
        user: {
          id: srv.client.user.id,
          firstName: srv.client.user.firstName,
          lastName: srv.client.user.lastName,
          email: srv.client.user.email,
        },
      },
      agent: this.mapSession(sessionByClientId.get(srv.client.id), srv.client.id),
    }));
  }

  async findOne(serverId: string): Promise<Hub | null> {
    const srv = await this.serverRepo.findOne({
      where: { id: serverId },
      relations: ['client', 'client.user'],
    });
    if (!srv) return null;

    const session = await this.sessionRepo.findOne({ where: { clientId: srv.client.id } });

    return {
      id: srv.id,
      name: srv.name,
      subdomain: srv.subdomain,
      hubId: srv.hubId ?? null,
      publicUrl: this.publicUrl(srv),
      localUrl: srv.localUrl ?? null,
      status: srv.status,
      haVersion: srv.haVersion ?? null,
      accessEnabled: srv.accessEnabled,
      accessExpiresAt: srv.accessExpiresAt ?? null,
      lastSeenAt: srv.lastSeenAt ?? null,
      tunnelId: srv.tunnelId ?? null,
      cfAccessAppId: srv.cfAccessAppId ?? null,
      client: {
        id: srv.client.id,
        phone: (srv.client as any).phone ?? null,
        city: (srv.client as any).city ?? null,
        user: {
          id: srv.client.user.id,
          firstName: srv.client.user.firstName,
          lastName: srv.client.user.lastName,
          email: srv.client.user.email,
        },
      },
      agent: this.mapSession(session ?? undefined, srv.client.id),
    };
  }
}
