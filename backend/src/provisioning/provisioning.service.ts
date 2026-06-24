import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Client } from '../clients/entities/client.entity';
import { Server } from '../servers/entities/server.entity';
import { ServersService } from '../servers/servers.service';
import { TintaCoreService } from '../tinta-core/tinta-core.service';
import { GoldenTemplateService } from '../tinta-core/golden-template.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ClientsService } from '../clients/clients.service';

export interface ProvisionClientDto {
  // New client data
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  city?: string;
  // Server data
  serverName: string;
  subdomain: string;           // e.g. "mueller" → mueller.tinta-lab.de
  localUrl?: string;
  // Options
  applyDefaultTemplates?: boolean;
}

export interface ProvisionResult {
  clientId: string;
  serverId: string;
  agentToken: string;
  installToken: string;
  installUrl: string;
  tunnelToken: string | null;
  subdomain: string;
  dashboardUrl: string;
  agentInstallCommand: string;
}

export interface InstallConfig {
  clientId: string;
  agentToken: string;
  coreWs: string;
  externalUrl: string;
  tunnelToken: string | null;
  serverName: string;
  clientName: string;
  expiresAt: string;
}

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Server)
    private readonly serverRepo: Repository<Server>,
    private readonly clientsService: ClientsService,
    private readonly serversService: ServersService,
    private readonly tintaCore: TintaCoreService,
    private readonly templateService: GoldenTemplateService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Full one-click provisioning:
   * 1. Create client + user account
   * 2. Create server (auto-provisions Cloudflare tunnel if configured)
   * 3. Generate Tinta Agent JWT
   * 4. Apply default golden templates
   * 5. Send onboarding notification
   */
  async provisionClient(dto: ProvisionClientDto): Promise<ProvisionResult> {
    this.logger.log(`Provisioning client: ${dto.email}`);

    // 1. Create client account
    let client: Client;
    try {
      client = await this.clientsService.create({
        email: dto.email,
        password: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        city: dto.city,
      });
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.code === '23505') {
        throw new ConflictException('Email already exists');
      }
      throw err;
    }

    // 2. Create server (Cloudflare auto-provisions tunnel if API key set)
    const baseDomain = this.config.get('CLOUDFLARE_BASE_DOMAIN', 'tinta-lab.de');
    // Normalise: always store the full hostname so URL construction works everywhere
    const fullSubdomain = dto.subdomain.includes('.')
      ? dto.subdomain
      : `${dto.subdomain}.${baseDomain}`;

    const server = await this.serversService.create({
      clientId: client.id,
      name: dto.serverName,
      subdomain: fullSubdomain,
      localUrl: dto.localUrl,
    });

    // 3. Generate Agent JWT + install token
    const { agentToken, installToken } = await this.tintaCore.provisionAgent(client.id);

    // 4. Apply default golden templates (non-blocking)
    if (dto.applyDefaultTemplates !== false) {
      const templates = await this.templateService.findAll();
      for (const t of templates) {
        await this.tintaCore.applyGoldenTemplate(client.id, t.slug).catch(() => {
          // Agent not connected yet — will be applied on first connect
        });
      }
    }

    // 5. Notify admin via Telegram
    const dashboardUrl = `https://${fullSubdomain}`;
    const clientName = `${dto.firstName} ${dto.lastName}`;

    await this.notifications.notifyProvisioningComplete({
      clientName,
      clientEmail: dto.email,
      serverName: dto.serverName,
      subdomain: dto.subdomain,
      dashboardUrl,
      agentToken,
      tunnelToken: server.tunnelToken,
    });

    const frontendUrl = this.config.get('FRONTEND_URL', 'https://app.tinta-lab.de');
    const installUrl = `${frontendUrl}/install/${installToken}`;

    const agentInstallCommand = server.tunnelToken
      ? `# 1. Install Cloudflare tunnel\ncloudflared tunnel run --token ${server.tunnelToken}\n\n# 2. Install Tinta Agent (HA Add-on)\n# Go to HA → Add-ons → Install → set:\n# tinta_client_id: ${client.id}\n# tinta_agent_token: ${agentToken}`
      : `# Install Tinta Agent (HA Add-on)\n# Set options:\n# tinta_client_id: ${client.id}\n# tinta_agent_token: ${agentToken}`;

    this.logger.log(`Provisioning complete for ${dto.email} (client: ${client.id}, server: ${server.id})`);

    return {
      clientId: client.id,
      serverId: server.id,
      agentToken,
      installToken,
      installUrl,
      tunnelToken: server.tunnelToken,
      subdomain: fullSubdomain,
      dashboardUrl,
      agentInstallCommand,
    };
  }

  async getInstallConfig(token: string): Promise<InstallConfig> {
    const session = await this.tintaCore.getSessionByInstallToken(token);
    const [servers, client] = await Promise.all([
      this.serversService.findByClientId(session.clientId),
      this.clientsService.findById(session.clientId),
    ]);
    const server = servers[0];
    const coreWs = this.config.get('TINTA_CORE_WS', 'wss://api.tinta-lab.de/tinta/ws');

    return {
      clientId: session.clientId,
      agentToken: session.agentToken,
      coreWs,
      externalUrl: server ? `https://${server.subdomain}` : '',
      tunnelToken: server?.tunnelToken ?? null,
      serverName: server?.name ?? '',
      clientName: `${client.user?.firstName ?? ''} ${client.user?.lastName ?? ''}`.trim(),
      expiresAt: session.installTokenExpiresAt.toISOString(),
    };
  }
}
