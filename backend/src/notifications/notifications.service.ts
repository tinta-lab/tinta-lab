import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { NotificationOutbox } from './entities/notification-outbox.entity';
import { NotificationDispatcher } from './notification-dispatcher';
import { NotificationEventType, policyFor } from './notification-policy';
import type {
  AccessGrantedPayload,
  AccessRevokedPayload,
  AgentOfflinePayload,
  ProvisioningCompletePayload,
  SecurityAnomalyPayload,
} from './notification-templates';

// Queues notifications in notification_outbox; NotificationDispatcher
// delivers them to Telegram with retries (sql/013_notification_outbox.sql).
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationOutbox)
    private readonly outbox: Repository<NotificationOutbox>,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  // With `manager`, the row is part of the caller's transaction — committed
  // together with the event it is about. Call kick() after that commit (the
  // dispatcher's interval picks it up within seconds anyway). Throws if the
  // row can't be written, so the caller's transaction can react.
  async enqueue(
    eventType: NotificationEventType,
    payload:
      | SecurityAnomalyPayload
      | ProvisioningCompletePayload
      | AgentOfflinePayload
      | AccessGrantedPayload
      | AccessRevokedPayload,
    manager?: EntityManager,
  ): Promise<string> {
    const policy = policyFor(eventType);
    const repo = manager
      ? manager.getRepository(NotificationOutbox)
      : this.outbox;
    const row = await repo.save(
      repo.create({
        eventType,
        priority: policy.priority,
        payload: payload as unknown as Record<string, unknown>,
        maxAttempts: policy.maxAttempts,
        status: 'pending',
      }),
    );
    if (!manager) this.dispatcher.kick();
    return row.id;
  }

  kick(): void {
    this.dispatcher.kick();
  }

  // Informational: never fails the caller — a lost notice is acceptable,
  // it's logged.
  async notifyProvisioningComplete(
    params: ProvisioningCompletePayload,
  ): Promise<void> {
    await this.enqueueQuietly('provisioning_complete', params);
  }

  async notifyAgentOffline(params: {
    clientName: string;
    clientId: string;
    lastSeen: Date | null;
  }): Promise<void> {
    await this.enqueueQuietly('agent_offline', {
      ...params,
      lastSeen: params.lastSeen?.toISOString() ?? null,
    });
  }

  async notifyAccessGranted(params: {
    clientName: string;
    clientEmail: string;
    serverName: string;
    serverUrl: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.enqueueQuietly('access_granted', {
      ...params,
      expiresAt: params.expiresAt.toISOString(),
    });
  }

  async notifyAccessRevoked(params: AccessRevokedPayload): Promise<void> {
    await this.enqueueQuietly('access_revoked', params);
  }

  private async enqueueQuietly(
    eventType: NotificationEventType,
    payload: Parameters<NotificationsService['enqueue']>[1],
  ): Promise<void> {
    try {
      await this.enqueue(eventType, payload);
    } catch (err) {
      this.logger.error(
        `notification.not_queued kind=${eventType} error="${err instanceof Error ? err.message : String(err)}"`,
      );
    }
  }
}
