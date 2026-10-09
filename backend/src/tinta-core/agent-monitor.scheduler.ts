import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Like, Repository } from 'typeorm';
import { AgentSession, AgentStatus } from './entities/agent-session.entity';
import { Ticket, TicketStatus, TicketType } from '../tickets/entities/ticket.entity';
import { ServersService } from '../servers/servers.service';
import { OFFLINE_THRESHOLD_MS } from './agent-offline-threshold';

export const AUTO_OFFLINE_PREFIX = '[AUTO] Агент офлайн';

const OPEN_STATUSES = [TicketStatus.NEW, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_CLIENT];

// Raises an [AUTO] ticket when an agent goes silent and resolves it again
// when the agent is back. Deduplication used to be an in-memory Set, which
// every backend restart (= every deploy) forgot, and nothing ever closed the
// tickets: two from 2026-09-21 were still "new" weeks after both hubs had
// come back online. Both now go through the ticket table itself.
@Injectable()
export class AgentMonitorScheduler {
  private readonly logger = new Logger(AgentMonitorScheduler.name);

  constructor(
    @InjectRepository(AgentSession)
    private readonly sessionRepo: Repository<AgentSession>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    private readonly serversService: ServersService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAgentHealth() {
    const threshold = new Date(Date.now() - OFFLINE_THRESHOLD_MS);

    // Sessions that were connected but haven't sent a heartbeat in > 5 min
    const stale = await this.sessionRepo.find({
      where: {
        status: AgentStatus.CONNECTED,
        lastHeartbeatAt: LessThan(threshold),
      },
      relations: ['client', 'client.user'],
    });

    for (const session of stale) {
      await this.sessionRepo.update(
        { clientId: session.clientId },
        { status: AgentStatus.DISCONNECTED },
      );
      this.logger.warn(
        `Agent ${session.clientId} marked offline (no heartbeat since ${session.lastHeartbeatAt?.toISOString()})`,
      );
      await this.raiseOfflineTicket(session);
    }

    // Back online → resolve the alert nobody has started working on yet.
    // Tickets a staff member already picked up are left alone.
    const online = await this.sessionRepo.find({
      where: { status: AgentStatus.CONNECTED },
      relations: ['client', 'client.user'],
    });
    for (const session of online) {
      await this.resolveOfflineTickets(session);
    }
  }

  private async raiseOfflineTicket(session: AgentSession): Promise<void> {
    const existing = await this.ticketRepo.findOne({
      where: {
        client: { id: session.clientId },
        subject: Like(`${AUTO_OFFLINE_PREFIX}%`),
        status: In(OPEN_STATUSES),
      },
    });
    if (existing) return;

    const clientName = session.client?.user
      ? `${session.client.user.firstName} ${session.client.user.lastName}`
      : session.clientId;
    const [server] = await this.serversService.findByClientId(session.clientId).catch(() => []);

    await this.ticketRepo.save(
      this.ticketRepo.create({
        name: clientName,
        email: session.client?.user?.email ?? 'auto@tinta-system',
        subject: `${AUTO_OFFLINE_PREFIX}: ${clientName}`,
        message:
          `Tinta Agent для клиента ${clientName} (${session.clientId}) не отправлял heartbeat более 5 минут.\n\n` +
          `Последний heartbeat: ${session.lastHeartbeatAt?.toLocaleString('de-DE') ?? 'неизвестно'}\n` +
          `Версия агента: ${session.agentVersion ?? '?'}\n` +
          `Версия HA: ${session.haVersion ?? '?'}\n\n` +
          `Требуется проверка подключения. Тикет закроется сам, если агент вернётся до начала работы над ним.`,
        type: TicketType.SUPPORT,
        client: { id: session.clientId } as any,
        server: server ? ({ id: server.id } as any) : null,
      }),
    );
    this.logger.log(`Auto-ticket created for offline agent ${session.clientId}`);
  }

  private async resolveOfflineTickets(session: AgentSession): Promise<void> {
    // Older auto-tickets were saved without a client link — match those by
    // the client's email so they get cleaned up too.
    const email = session.client?.user?.email;
    const tickets = await this.ticketRepo.find({
      where: [
        { client: { id: session.clientId }, subject: Like(`${AUTO_OFFLINE_PREFIX}%`), status: TicketStatus.NEW },
        ...(email ? [{ email, subject: Like(`${AUTO_OFFLINE_PREFIX}%`), status: TicketStatus.NEW }] : []),
      ],
    });
    for (const ticket of tickets) {
      const note = `[AUTO] Agent wieder online: ${new Date().toLocaleString('de-DE')} — automatisch gelöst.`;
      await this.ticketRepo.update(ticket.id, {
        status: TicketStatus.RESOLVED,
        internalNotes: ticket.internalNotes ? `${ticket.internalNotes}\n${note}` : note,
      });
      this.logger.log(`Auto-ticket ${ticket.id} resolved: agent ${session.clientId} back online`);
    }
  }
}
