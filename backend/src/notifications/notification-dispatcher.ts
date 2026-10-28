import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TelegramSender, SendResult } from './telegram-sender';
import { renderNotification } from './notification-templates';
import { backoffMs } from './notification-policy';
import { AttemptOutcome } from './entities/notification-attempt.entity';

// How long a claimed notification belongs to this dispatcher. Longer than a
// send can take (45s budget), so only a crashed/stuck send loses its claim.
const LEASE_SECONDS = 120;
const MAX_PER_TICK = 20;
const RETENTION_DAYS = 90;

interface ClaimedRow {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  isTest: boolean;
}

// Delivers queued notifications (notification_outbox) to Telegram — see
// sql/013_notification_outbox.sql. Safe with several dispatchers on one
// database: a row is claimed with FOR UPDATE SKIP LOCKED and leased via
// "lockedUntil"; a lease that expires (process died mid-send) makes the row
// claimable again. Delivery is at-least-once.
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);
  private running = false;
  private rerun = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly sender: TelegramSender,
  ) {}

  // Deliver right away instead of waiting for the next interval.
  kick(): void {
    setImmediate(() => void this.tick());
  }

  // Returns how many notifications it handled. Never throws.
  @Interval('notification-dispatch', 5_000)
  async tick(): Promise<number> {
    if (this.running) {
      this.rerun = true;
      return 0;
    }
    // Unconfigured: leave everything queued (a growing queue age in Grafana
    // is the signal); TelegramSender already warned at startup.
    if (!this.sender.configured) return 0;

    this.running = true;
    let handled = 0;
    try {
      do {
        this.rerun = false;
        for (let i = 0; i < MAX_PER_TICK; i++) {
          const row = await this.claim();
          if (!row) break;
          await this.deliver(row);
          handled++;
        }
      } while (this.rerun);
    } catch (err) {
      // e.g. Postgres unavailable — nothing is lost, the next tick retries.
      this.logger.error(`notification.dispatch_error error="${message(err)}"`);
    } finally {
      this.running = false;
    }
    return handled;
  }

  async claim(): Promise<ClaimedRow | null> {
    const result: unknown = await this.dataSource.query(
      `UPDATE notification_outbox
          SET status = 'processing',
              attempts = attempts + 1,
              "lockedUntil" = now() + make_interval(secs => $1)
        WHERE id = (
          SELECT id FROM notification_outbox
           WHERE (status = 'pending' AND "nextAttemptAt" <= now())
              OR (status = 'processing' AND "lockedUntil" < now())
           ORDER BY priority, "nextAttemptAt"
           FOR UPDATE SKIP LOCKED
           LIMIT 1)
        RETURNING id, "eventType", payload, attempts, "maxAttempts", "isTest"`,
      [LEASE_SECONDS],
    );
    // TypeORM returns [rows, affected] for UPDATE ... RETURNING on Postgres.
    const rows = (
      Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result
    ) as ClaimedRow[];
    return rows[0] ?? null;
  }

  private async deliver(row: ClaimedRow): Promise<void> {
    // Reclaimed after its final attempt crashed mid-send: don't exceed the
    // policy, record it as failed.
    if (row.attempts > row.maxAttempts) {
      await this.record(
        row,
        { ok: false, httpAttempts: 0, errorCode: 'abandoned' },
        0,
        'failed',
      );
      return;
    }

    const started = Date.now();
    let result: SendResult;
    try {
      result = await this.sender.send(
        row.eventType,
        renderNotification(row.eventType, row.payload, row.id, row.isTest),
      );
    } catch (err) {
      // TelegramSender never throws; a template bug must not wedge the row.
      this.logger.error(
        `notification.render_error kind=${row.eventType} id=${row.id} error="${message(err)}"`,
      );
      result = { ok: false, httpAttempts: 0, errorCode: 'render_error' };
    }
    const duration = Date.now() - started;

    const outcome: AttemptOutcome = result.ok
      ? 'sent'
      : row.attempts >= row.maxAttempts
        ? 'failed'
        : 'retry';
    await this.record(row, result, duration, outcome);
  }

  private async record(
    row: ClaimedRow,
    result: SendResult,
    durationMs: number,
    outcome: AttemptOutcome,
  ): Promise<void> {
    const nextInMs =
      outcome === 'retry' ? backoffMs(row.eventType, row.attempts) : 0;
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO notification_attempts
           ("notificationId", "eventType", outcome, "httpAttempts", "errorCode", "durationMs", "isTest")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          row.id,
          row.eventType,
          outcome,
          result.httpAttempts,
          result.errorCode,
          durationMs,
          row.isTest,
        ],
      );
      await manager.query(
        `UPDATE notification_outbox
            SET status = $2::varchar,
                "sentAt" = CASE WHEN $2::varchar = 'sent' THEN now() ELSE "sentAt" END,
                "nextAttemptAt" = now() + make_interval(secs => $3::double precision / 1000),
                "lockedUntil" = NULL,
                "lastErrorCode" = $4
          WHERE id = $1`,
        [
          row.id,
          outcome === 'retry' ? 'pending' : outcome,
          nextInMs,
          result.ok ? null : result.errorCode,
        ],
      );
    });

    const base = `kind=${row.eventType} id=${row.id.slice(0, 8)} attempt=${row.attempts}/${row.maxAttempts}${row.isTest ? ' test=true' : ''}`;
    if (outcome === 'sent') {
      this.logger.log(`notification.sent ${base}`);
    } else if (outcome === 'retry') {
      this.logger.warn(
        `notification.retry ${base} error=${result.errorCode} next_in=${Math.round(nextInMs / 1000)}s`,
      );
    } else {
      this.logger.error(
        `notification.failed ${base} error=${result.errorCode} — left in notification_outbox as 'failed'`,
      );
    }
  }

  // Sent notifications and old attempt history are only needed for the
  // Grafana window; failed ones stay for diagnosis.
  @Cron('17 4 * * *')
  async purge(): Promise<void> {
    try {
      await this.dataSource.query(
        `DELETE FROM notification_attempts WHERE "attemptedAt" < now() - make_interval(days => $1)`,
        [RETENTION_DAYS],
      );
      await this.dataSource.query(
        `DELETE FROM notification_outbox WHERE status = 'sent' AND "sentAt" < now() - make_interval(days => $1)`,
        [RETENTION_DAYS],
      );
    } catch (err) {
      this.logger.warn(`notification.purge_failed error="${message(err)}"`);
    }
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
