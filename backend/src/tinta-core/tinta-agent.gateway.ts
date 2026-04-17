import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentSession, AgentStatus } from './entities/agent-session.entity';
import { TintaCommand } from './entity-mapper.service';

interface AgentRegisterPayload {
  clientId: string;
  jwt: string;
  agentVersion?: string;
  haVersion?: string;
}

@WebSocketGateway({
  namespace: '/tinta/ws',
  cors: { origin: '*' },
})
export class TintaAgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TintaAgentGateway.name);
  // clientId → socket
  private readonly agents = new Map<string, Socket>();

  constructor(
    @InjectRepository(AgentSession)
    private readonly sessionRepo: Repository<AgentSession>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Agent socket connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    // Find clientId by socket
    for (const [clientId, socket] of this.agents.entries()) {
      if (socket.id === client.id) {
        this.agents.delete(clientId);
        await this.sessionRepo.update({ clientId }, { status: AgentStatus.DISCONNECTED });
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
      const secret = (this.config.get<string>('AGENT_JWT_SECRET') ?? this.config.get<string>('JWT_SECRET') ?? '') as string;
      const decoded = this.jwtService.verify(jwt, { secret }) as { sub: string; type: string };
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

    // Verify token matches stored agentToken in DB
    const stored = await this.sessionRepo.findOne({ where: { clientId } });
    if (stored?.agentToken && stored.agentToken !== jwt) {
      this.logger.warn(`Agent token mismatch for ${clientId} — possible replay`);
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

    this.logger.log(`Agent registered: ${clientId} (v${agentVersion ?? '?'}, HA ${haVersion ?? '?'})`);
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
    @MessageBody() payload: {
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
    this.server.to('dashboard').emit('agent:metrics', { clientId, ...payload });
  }

  @SubscribeMessage('state_update')
  async handleStateUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { entities: Record<string, any> },
  ) {
    const clientId = client.data.clientId as string | undefined;
    if (!clientId) return;

    this.server.to('dashboard').emit('agent:state', { clientId, ...payload });
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
  async executeCommand(clientId: string, command: TintaCommand): Promise<boolean> {
    const socket = this.agents.get(clientId);
    if (!socket) {
      this.logger.warn(`Agent ${clientId} not connected`);
      return false;
    }
    socket.emit('command', command);
    this.logger.log(`Command sent to ${clientId}: ${command.entityType}.${command.action}`);
    return true;
  }

  // Apply golden template to a connected agent
  async applyTemplate(clientId: string, template: Record<string, any>): Promise<boolean> {
    const socket = this.agents.get(clientId);
    if (!socket) return false;
    socket.emit('apply_template', template);
    return true;
  }

  isConnected(clientId: string): boolean {
    return this.agents.has(clientId);
  }

  getConnectedAgents(): string[] {
    return Array.from(this.agents.keys());
  }
}
