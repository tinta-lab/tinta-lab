import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AgentSession, AgentStatus } from './entities/agent-session.entity';
import { TintaAgentGateway } from './tinta-agent.gateway';
import { EntityMapperService, TintaCommand } from './entity-mapper.service';
import { GoldenTemplateService } from './golden-template.service';

@Injectable()
export class TintaCoreService {
  private readonly logger = new Logger(TintaCoreService.name);

  constructor(
    @InjectRepository(AgentSession)
    private readonly sessionRepo: Repository<AgentSession>,
    private readonly gateway: TintaAgentGateway,
    private readonly entityMapper: EntityMapperService,
    private readonly templateService: GoldenTemplateService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Generate a long-lived JWT for a Tinta Agent
  generateAgentToken(clientId: string): string {
    return this.jwtService.sign(
      { sub: clientId, type: 'tinta-agent' },
      {
        secret: this.config.get('AGENT_JWT_SECRET', this.config.get('JWT_SECRET')),
        expiresIn: '365d',
      },
    );
  }

  // Provision: create agent session + generate token
  async provisionAgent(clientId: string): Promise<{ agentToken: string }> {
    const existing = await this.sessionRepo.findOne({ where: { clientId } });
    const agentToken = this.generateAgentToken(clientId);

    if (!existing) {
      const newSession = this.sessionRepo.create({
        clientId,
        client: { id: clientId } as any,
        status: AgentStatus.DISCONNECTED,
        agentToken,
        appliedTemplates: [],
      } as any);
      await this.sessionRepo.save(newSession as any);
    } else {
      await this.sessionRepo.update({ clientId }, { agentToken });
    }
    this.logger.log(`Agent provisioned for client ${clientId}`);
    return { agentToken };
  }

  async getSession(clientId: string): Promise<AgentSession | null> {
    return this.sessionRepo.findOne({ where: { clientId }, relations: ['client'] });
  }

  async getAllSessions(): Promise<AgentSession[]> {
    return this.sessionRepo.find({ relations: ['client'] });
  }

  async executeAction(clientId: string, command: TintaCommand): Promise<{ sent: boolean }> {
    const haCommand = this.entityMapper.toHA(command);
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
