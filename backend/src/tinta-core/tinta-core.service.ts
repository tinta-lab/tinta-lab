import { Injectable, Logger, NotFoundException, GoneException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AgentSession, AgentStatus } from './entities/agent-session.entity';
import { TintaAgentGateway } from './tinta-agent.gateway';
import { TintaCommand } from './entity-mapper.service';
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
        secret: this.config.get<string>('AGENT_JWT_SECRET') ?? this.config.get<string>('JWT_SECRET'),
        expiresIn: '365d',
      },
    );
  }

  // Provision: create/rotate agent token — disconnects any running agent with old token
  async provisionAgent(clientId: string): Promise<{ agentToken: string; installToken: string }> {
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
      this.gateway.disconnectAgent(clientId, 'Token rotated — re-provision required');
      await this.sessionRepo.update({ clientId }, {
        agentToken,
        status: AgentStatus.DISCONNECTED,
        installToken,
        installTokenExpiresAt,
      });
    }

    this.logger.log(`Agent provisioned for client ${clientId}${existing ? ' (token rotated)' : ''}`);
    return { agentToken, installToken };
  }

  async getSessionByInstallToken(token: string): Promise<{ clientId: string; agentToken: string; installTokenExpiresAt: Date }> {
    const session = await this.sessionRepo.findOne({ where: { installToken: token } });
    if (!session) throw new NotFoundException('Install link not found');
    if (!session.installTokenExpiresAt || session.installTokenExpiresAt < new Date()) {
      throw new GoneException('Install link has expired');
    }
    return {
      clientId: session.clientId,
      agentToken: session.agentToken!,
      installTokenExpiresAt: session.installTokenExpiresAt,
    };
  }

  async getSession(clientId: string): Promise<AgentSession | null> {
    return this.sessionRepo.findOne({ where: { clientId }, relations: ['client'] });
  }

  async getAllSessions(): Promise<Partial<AgentSession>[]> {
    const sessions = await this.sessionRepo.find({ relations: ['client', 'client.user'] });
    return sessions.map(({ agentToken, installToken, ...safe }) => safe);
  }

  async executeAction(clientId: string, command: TintaCommand): Promise<{ sent: boolean }> {
    const sent = await this.gateway.executeCommand(clientId, command);
    if (!sent) this.logger.warn(`Client ${clientId} agent offline, command queued`);
    return { sent };
  }

  async applyGoldenTemplate(clientId: string, templateSlug: string): Promise<{ sent: boolean }> {
    const template = await this.templateService.findBySlug(templateSlug);
    const session = await this.sessionRepo.findOne({ where: { clientId } });
    if (!session) throw new NotFoundException(`No agent session for client ${clientId}`);

    if (this.templateService.isApplied(session, templateSlug)) {
      this.logger.log(`Template ${templateSlug} already applied for ${clientId}`);
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
}
