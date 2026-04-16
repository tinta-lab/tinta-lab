import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AgentSession, AgentStatus } from './entities/agent-session.entity';
import { Ticket, TicketType } from '../tickets/entities/ticket.entity';

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class AgentMonitorScheduler {
  private readonly logger = new Logger(AgentMonitorScheduler.name);
  // Track which clients already have an open alert ticket to avoid duplicates
  private readonly alertedClients = new Set<string>();

  constructor(
    @InjectRepository(AgentSession)
    private readonly sessionRepo: Repository<AgentSession>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAgentHealth() {
    const threshold = new Date(Date.now() - OFFLINE_THRESHOLD_MS);

    // Find sessions that were connected but haven't sent a heartbeat in > 5 min
    const stale = await this.sessionRepo.find({
      where: {
        status: AgentStatus.CONNECTED,
        lastHeartbeatAt: LessThan(threshold),
      },
      relations: ['client', 'client.user'],
    });

    for (const session of stale) {
      // Mark as disconnected
      await this.sessionRepo.update({ clientId: session.clientId }, { status: AgentStatus.DISCONNECTED });
      this.logger.warn(`Agent ${session.clientId} marked offline (no heartbeat since ${session.lastHeartbeatAt?.toISOString()})`);

      // Create auto-ticket if not already alerted
      if (!this.alertedClients.has(session.clientId)) {
        this.alertedClients.add(session.clientId);
        const clientName = session.client?.user
          ? `${session.client.user.firstName} ${session.client.user.lastName}`
          : session.clientId;
        const clientEmail = session.client?.user?.email ?? 'auto@tinta-system';

        await this.ticketRepo.save(
          this.ticketRepo.create({
            name: clientName,
            email: clientEmail,
            subject: `[AUTO] Агент офлайн: ${clientName}`,
            message:
              `Tinta Agent для клиента ${clientName} (${session.clientId}) не отправлял heartbeat более 5 минут.\n\n` +
              `Последний heartbeat: ${session.lastHeartbeatAt?.toLocaleString('de-DE') ?? 'неизвестно'}\n` +
              `Версия агента: ${session.agentVersion ?? '?'}\n` +
              `Версия HA: ${session.haVersion ?? '?'}\n\n` +
              `Требуется проверка подключения.`,
            type: TicketType.SUPPORT,
          } as any),
        );
        this.logger.log(`Auto-ticket created for offline agent ${session.clientId}`);
      }
    }

    // Clear alerted status for clients that came back online
    const online = await this.sessionRepo.find({ where: { status: AgentStatus.CONNECTED } });
    for (const session of online) {
      this.alertedClients.delete(session.clientId);
    }
  }
}
