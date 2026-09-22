import {
  Injectable,
  Logger,
  NotFoundException,
  GoneException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  isValidAgentVersion,
  compareAgentVersions,
  isAgentDowngrade,
} from '../common/agent-version';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AgentSession, AgentStatus } from './entities/agent-session.entity';
import { TintaAgentGateway, DiagnosticsReport } from './tinta-agent.gateway';
import { TintaCommand } from './tinta-command.types';
import { GoldenTemplateService } from './golden-template.service';
import {
  AgentSessionViewDto,
  toAgentSessionView,
} from './dto/agent-session-view.dto';

// Session metadata for DiagnosticsService (PHASE1_3_DIAGNOSTICS_SPEC.md §5)
// — historical/persisted fields, distinct from getDiagnostics()'s live
// observation. Strips agentToken/installToken same as getAllSessions();
// omits client/clientId since callers already have the clientId they
// queried with.
export interface AgentSessionSummary {
  status: AgentStatus;
  agentVersion: string | null;
  haVersion: string | null;
  appliedTemplates: string[];
  metrics: AgentSession['metrics'];
  lastConnectedAt: Date | null;
  lastHeartbeatAt: Date | null;
  lastTokenMismatchAt: Date | null;
  installTokenExpiresAt: Date | null;
  serviceStartConsentAt: Date | null;
}

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
    serviceStartConsentAt: Date | null;
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
      serviceStartConsentAt: session.serviceStartConsentAt,
    };
  }

  // Records the § 356 Abs. 4 BGB consent (see entity doc comment). Idempotent
  // on purpose: a client re-opening the link after already consenting must
  // not have their original consent timestamp overwritten.
  async recordServiceStartConsent(token: string): Promise<void> {
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
    if (!session.serviceStartConsentAt) {
      await this.sessionRepo.update(session.id, {
        serviceStartConsentAt: new Date(),
      });
    }
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

  async getAllSessions(): Promise<AgentSessionViewDto[]> {
    const sessions = await this.sessionRepo.find({
      relations: ['client', 'client.user'],
    });
    return sessions.map(toAgentSessionView);
  }

  async getSessionSummary(
    clientId: string,
  ): Promise<AgentSessionSummary | null> {
    const session = await this.sessionRepo.findOne({ where: { clientId } });
    if (!session) return null;
    return {
      status: session.status,
      agentVersion: session.agentVersion,
      haVersion: session.haVersion,
      appliedTemplates: session.appliedTemplates,
      metrics: session.metrics,
      lastConnectedAt: session.lastConnectedAt,
      lastHeartbeatAt: session.lastHeartbeatAt,
      lastTokenMismatchAt: session.lastTokenMismatchAt,
      installTokenExpiresAt: session.installTokenExpiresAt,
      serviceStartConsentAt: session.serviceStartConsentAt,
    };
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

  // Single source of truth for "what's the current stable Agent release" —
  // set by ops as part of the Agent release checklist (see RUNBOOK.md), not
  // hardcoded in the frontend. Dashboard reads this to decide whether to
  // show an update badge at all; updateAgent() reads it as the default
  // target when the caller doesn't pin a specific version.
  getReleaseInfo(): { latestStable: string } {
    const latestStable = this.config.get<string>('AGENT_LATEST_STABLE_VERSION');
    if (!isValidAgentVersion(latestStable)) {
      throw new InternalServerErrorException(
        'AGENT_LATEST_STABLE_VERSION is not configured or invalid — see RUNBOOK.md release checklist',
      );
    }
    return { latestStable };
  }

  // Admin: trigger agent self-update. targetVersion is optional — when
  // omitted, defaults to the configured latest stable release, so the
  // frontend never has to know or supply a version number itself.
  //
  // Downgrade protection lives here, not in the frontend: this is the only
  // layer every caller (dashboard, future CLI/API callers) is forced
  // through. See tinta-agent-pub/.../agent.ts triggerSelfUpdate() for the
  // second, independent guard on the Agent side (defense-in-depth — this
  // endpoint should never be the only thing standing between an admin
  // click and a real downgrade via HA Supervisor).
  async updateAgent(
    clientId: string,
    targetVersion?: string,
  ): Promise<{ sent: boolean; online: boolean; alreadyUpToDate?: boolean }> {
    const session = await this.sessionRepo.findOne({ where: { clientId } });
    if (!session) throw new NotFoundException(`No agent session for client ${clientId}`);

    const resolved = targetVersion?.trim() || this.getReleaseInfo().latestStable;
    if (!isValidAgentVersion(resolved)) {
      throw new BadRequestException(`Invalid target version: ${resolved}`);
    }

    const installed = session.agentVersion;
    if (isValidAgentVersion(installed)) {
      if (isAgentDowngrade(installed, resolved)) {
        throw new ConflictException(
          `Refusing to downgrade agent ${clientId} from ${installed} to ${resolved}. ` +
            'Intentional rollback requires a separate, explicitly-audited operation.',
        );
      }
      if (compareAgentVersions(installed, resolved) === 0) {
        return { sent: false, online: this.gateway.isConnected(clientId), alreadyUpToDate: true };
      }
    }

    const online = this.gateway.isConnected(clientId);
    if (!online) return { sent: false, online: false };
    const sent = this.gateway.sendSelfUpdate(clientId, resolved);
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
