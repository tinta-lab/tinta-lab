import {
  Injectable,
  Logger,
  NotFoundException,
  GoneException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AgentSession, AgentStatus } from './entities/agent-session.entity';
import { TintaAgentGateway, DiagnosticsReport } from './tinta-agent.gateway';
import { TintaCommand } from './tinta-command.types';
import { GoldenTemplateService } from './golden-template.service';

@Injectable()
export class TintaCoreService {
  private readonly logger = new Logger(TintaCoreService.name);

  constructor(
    @InjectRepository(AgentSession)
    private readonly sessionRepo: Repository<AgentSession>,
    private readonly gateway: TintaAgentGateway,
    private readonly templateService: GoldenTemplateService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Generate a long-lived JWT for a Tinta Agent
  generateAgentToken(clientId: string): string {
    return this.jwtService.sign(
      { sub: clientId, type: 'tinta-agent' },
      {
        secret:
          this.config.get<string>('AGENT_JWT_SECRET') ??
          this.config.get<string>('JWT_SECRET'),
        expiresIn: '365d',
      },
    );
  }

  // Provision: create/rotate agent token — disconnects any running agent with old token
  async provisionAgent(
    clientId: string,
  ): Promise<{ agentToken: string; installToken: string }> {
    const existing = await this.sessionRepo.findOne({ where: { clientId } });
    const agentToken = this.generateAgentToken(clientId);
    const installToken = randomUUID();
    const installTokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    if (!existing) {
      const newSession = this.sessionRepo.create({
        clientId,
        client: { id: clientId } as any,
        status: AgentStatus.DISCONNECTED,
        agentToken,
        installToken,
        installTokenExpiresAt,
        appliedTemplates: [],
      } as any);
      await this.sessionRepo.save(newSession as any);
    } else {
      // Rotate token: disconnect currently running agent so it must re-authenticate
      this.gateway.disconnectAgent(
        clientId,
        'Token rotated — re-provision required',
      );
      await this.sessionRepo.update(
        { clientId },
        {
          agentToken,
          status: AgentStatus.DISCONNECTED,
          installToken,
          installTokenExpiresAt,
        },
      );
    }

    this.logger.log(
      `Agent provisioned for client ${clientId}${existing ? ' (token rotated)' : ''}`,
    );
    return { agentToken, installToken };
  }

  async getSessionByInstallToken(token: string): Promise<{
    clientId: string;
    agentToken: string;
    installTokenExpiresAt: Date;
  }> {
    const session = await this.sessionRepo.findOne({
      where: { installToken: token },
    });
    if (!session) throw new NotFoundException('Install link not found');
    if (
      !session.installTokenExpiresAt ||
      session.installTokenExpiresAt < new Date()
    ) {
      throw new GoneException('Install link has expired');
    }
    return {
      clientId: session.clientId,
      agentToken: session.agentToken!,
      installTokenExpiresAt: session.installTokenExpiresAt,
    };
  }

  // One-time consumption: called right after a successful GET /install/:token
  // fetch, not at agent register, so the link can't be replayed for the full
  // 48h window if it leaks (email, chat, shoulder-surfing). If the client
  // needs the page again (closed the tab, etc.), re-provision issues a fresh
  // token rather than the same link staying live.
  async consumeInstallToken(token: string): Promise<void> {
    await this.sessionRepo.update(
      { installToken: token },
      { installToken: null, installTokenExpiresAt: null },
    );
  }

  async getAllSessions(): Promise<Partial<AgentSession>[]> {
    const sessions = await this.sessionRepo.find({
      relations: ['client', 'client.user'],
    });
    return sessions.map(({ agentToken, installToken, ...safe }) => safe);
  }

  async executeAction(
    clientId: string,
    command: TintaCommand,
  ): Promise<{ sent: boolean }> {
    const sent = await this.gateway.executeCommand(clientId, command);
    if (!sent)
      this.logger.warn(`Client ${clientId} agent offline, command queued`);
    return { sent };
  }

  async updateAgent(clientId: string, targetVersion: string): Promise<{ sent: boolean; online: boolean }> {
    const online = this.gateway.isConnected(clientId);
    if (!online) return { sent: false, online: false };
    const sent = this.gateway.sendSelfUpdate(clientId, targetVersion);
    return { sent, online };
  }

  async applyGoldenTemplate(
    clientId: string,
    templateSlug: string,
  ): Promise<{ sent: boolean }> {
    const template = await this.templateService.findBySlug(templateSlug);
    const session = await this.sessionRepo.findOne({ where: { clientId } });
    if (!session)
      throw new NotFoundException(`No agent session for client ${clientId}`);

    if (this.templateService.isApplied(session, templateSlug)) {
      this.logger.log(
        `Template ${templateSlug} already applied for ${clientId}`,
      );
      return { sent: false };
    }

    const sent = await this.gateway.applyTemplate(clientId, {
      slug: template.slug,
      name: template.name,
      automation: template.automation,
    });

    if (sent) {
      await this.templateService.markApplied(clientId, templateSlug);
    }
    return { sent };
  }

  getConnectedAgents(): string[] {
    return this.gateway.getConnectedAgents();
  }

  // Live check — distinct from the stale `haVersion` snapshot taken at agent
  // startup. `agentOnline: false` means the agent itself has no socket to us;
  // `agentOnline: true, report: null` means it's connected but didn't answer
  // within the timeout (e.g. busy, or the HA websocket call is hanging).
  async getDiagnostics(
    clientId: string,
  ): Promise<{ agentOnline: boolean; report: DiagnosticsReport | null }> {
    const agentOnline = this.gateway.isConnected(clientId);
    if (!agentOnline) return { agentOnline: false, report: null };
    const report = await this.gateway.requestDiagnostics(clientId);
    return { agentOnline: true, report };
  }
}
