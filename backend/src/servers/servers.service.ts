import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Server, ServerStatus } from './entities/server.entity';
import { ServersGateway } from './servers.gateway';
import { CloudflareService } from '../cloudflare/cloudflare.service';
import { ConfigService } from '@nestjs/config';
import { generateHubId } from '../cloudflare/cloudflare.service';

@Injectable()
export class ServersService {
  private readonly logger = new Logger(ServersService.name);

  constructor(
    @InjectRepository(Server)
    private serversRepository: Repository<Server>,
    @Optional() private serversGateway: ServersGateway,
    @Optional() private cloudflare: CloudflareService,
    private config: ConfigService,
    private dataSource: DataSource,
  ) {}

  async create(data: {
    clientId: string;
    name: string;
    subdomain: string;
    tunnelId?: string;
    localUrl?: string;
  }): Promise<Server> {
    // Generate random hubId for the public Cloudflare hostname
    const hubId = generateHubId();

    const server = this.serversRepository.create({
      client: { id: data.clientId } as any,
      name: data.name,
      subdomain: data.subdomain,
      hubId,
      ...(data.tunnelId ? { tunnelId: data.tunnelId } : {}),
      ...(data.localUrl ? { localUrl: data.localUrl } : {}),
    } as any);
    const saved = (await this.serversRepository.save(
      server,
    )) as unknown as Server;

    // Auto-provision Cloudflare tunnel if API is configured and no tunnelId was provided
    if (!data.tunnelId && this.cloudflare?.isEnabled) {
      try {
        const baseDomain = this.config.get('CLOUDFLARE_BASE_DOMAIN', 'tinta-lab.de');
        // Use hub-{id}.domain as public hostname — hides client name from URL
        const hubHostname = `hub-${hubId}.${baseDomain}`;
        const cf = await this.cloudflare.provisionServer(data.name, hubHostname);
        await this.serversRepository.update(saved.id, {
          tunnelId: cf.tunnelId,
          tunnelToken: cf.tunnelToken,
          cfDnsRecordId: cf.cfDnsRecordId,
          cfAccessAppId: cf.cfAccessAppId,
        });
        saved.tunnelId = cf.tunnelId;
        saved.tunnelToken = cf.tunnelToken;
        saved.cfDnsRecordId = cf.cfDnsRecordId;
        (saved as any).cfAccessAppId = cf.cfAccessAppId;
        this.logger.log(`Cloudflare tunnel provisioned for server ${saved.id} at ${hubHostname}`);
      } catch (err: any) {
        this.logger.error(
          `Cloudflare provisioning failed for ${saved.id}: ${err.message}`,
        );
        // Don't throw — server is created, CF can be set up manually
      }
    }

    return saved;
  }

  /** Returns the public Cloudflare hostname for a server, e.g. hub-a7f3k9.tinta-lab.de */
  getPublicHostname(server: Server): string | null {
    if (!server.hubId) return null;
    const baseDomain = this.config.get('CLOUDFLARE_BASE_DOMAIN', 'tinta-lab.de');
    return `hub-${server.hubId}.${baseDomain}`;
  }

  async findAll(): Promise<Server[]> {
    return this.serversRepository.find({
      relations: ['client', 'client.user'],
    });
  }

  // Support role: only accessible servers, no sensitive infra fields, no client PII beyond name
  async findAccessibleForSupport(): Promise<Record<string, any>[]> {
    const servers = await this.serversRepository.find({
      where: { accessEnabled: true },
      relations: ['client', 'client.user'],
    });
    return servers.map(
      ({ localUrl, tunnelToken, tunnelId, cfDnsRecordId, ...safe }) => ({
        ...safe,
        client: safe.client
          ? {
              id: safe.client.id,
              user: safe.client.user
                ? {
                    id: safe.client.user.id,
                    firstName: safe.client.user.firstName,
                    lastName: safe.client.user.lastName,
                  }
                : undefined,
            }
          : undefined,
      }),
    );
  }

  async findByClientId(clientId: string): Promise<Server[]> {
    return this.serversRepository.find({
      where: { client: { id: clientId } },
      relations: ['client'],
    });
  }

  async findById(id: string): Promise<Server> {
    const server = await this.serversRepository.findOne({
      where: { id },
      relations: ['client', 'client.user'],
    });
    if (!server) throw new NotFoundException('Server not found');
    return server;
  }

  async updateStatus(id: string, status: ServerStatus): Promise<void> {
    await this.serversRepository.update(id, { status, lastSeenAt: new Date() });
    const server = await this.serversRepository.findOne({ where: { id } });
    if (server) {
      this.serversGateway?.emitServerUpdate({
        id,
        status,
        accessEnabled: server.accessEnabled,
        accessExpiresAt: server.accessExpiresAt,
        lastSeenAt: server.lastSeenAt,
      });
    }
  }

  async heartbeat(id: string, haVersion?: string): Promise<void> {
    await this.serversRepository.update(id, {
      status: ServerStatus.ONLINE,
      lastSeenAt: new Date(),
      ...(haVersion ? { haVersion } : {}),
    });
    const server = await this.serversRepository.findOne({ where: { id } });
    if (server) {
      this.serversGateway?.emitServerUpdate({
        id,
        status: ServerStatus.ONLINE,
        accessEnabled: server.accessEnabled,
        accessExpiresAt: server.accessExpiresAt,
        lastSeenAt: server.lastSeenAt,
      });
    }
  }

  async update(
    id: string,
    data: {
      name?: string;
      subdomain?: string;
      tunnelId?: string;
      localUrl?: string;
    },
  ): Promise<Server> {
    await this.serversRepository.update(id, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    // Cleanup Cloudflare resources before deleting
    if (this.cloudflare?.isEnabled) {
      const server = await this.serversRepository.findOne({ where: { id } });
      if (server?.tunnelId) {
        await this.cloudflare.deleteTunnel(server.tunnelId);
      }
      if (server?.cfDnsRecordId) {
        await this.cloudflare.deleteDnsRecord(server.cfDnsRecordId);
      }
      if (server?.cfAccessAppId) {
        await this.cloudflare.deleteAccessApp(server.cfAccessAppId);
      }
    }
    // Delete referencing access_logs first (FK has no CASCADE)
    await this.dataSource.query(`DELETE FROM access_logs WHERE "serverId" = $1`, [id]);
    await this.serversRepository.delete(id);
  }

  async setAccessEnabled(
    id: string,
    enabled: boolean,
    expiresAt?: Date,
  ): Promise<void> {
    await this.serversRepository.update(id, {
      accessEnabled: enabled,
      accessExpiresAt: expiresAt ?? null,
    });
    this.serversGateway?.emitAccessChanged(id, enabled, expiresAt ?? null);
  }
}
