import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { AuditEvent, AuditEventType } from './entities/audit-event.entity';

// Arbitrary fixed key for the Postgres advisory lock that serializes chain
// appends so prevHash never races under concurrent writes.
const AUDIT_CHAIN_LOCK_KEY = 741_852_963;

function computeHash(fields: {
  accessLogId: string;
  eventType: string;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  prevHash: string | null;
}): string {
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async append(
    accessLogId: string,
    eventType: AuditEventType,
    actorUserId: string | null,
    metadata: Record<string, unknown> = {},
  ): Promise<AuditEvent> {
    return this.dataSource.transaction(async (manager) => {
      // Serializes concurrent appends so "last event" below is stable.
      await manager.query('SELECT pg_advisory_xact_lock($1)', [
        AUDIT_CHAIN_LOCK_KEY,
      ]);

      const repo = manager.getRepository(AuditEvent);
      const last = await repo.findOne({ where: {}, order: { seq: 'DESC' } });
      const prevHash = last?.hash ?? null;
      const createdAt = new Date();

      const hash = computeHash({
        accessLogId,
        eventType,
        actorUserId,
        metadata,
        createdAt: createdAt.toISOString(),
        prevHash,
      });

      const event = repo.create({
        accessLogId,
        eventType,
        actorUserId,
        metadata,
        createdAt,
        prevHash,
        hash,
      });
      return repo.save(event);
    });
  }

  async getEventsForAccessLog(accessLogId: string): Promise<AuditEvent[]> {
    return this.dataSource.getRepository(AuditEvent).find({
      where: { accessLogId },
      order: { seq: 'ASC' },
    });
  }

  // Recomputes every hash in insertion order and checks the chain links up —
  // detects any row that was altered or deleted out from under the ledger.
  async verifyChain(): Promise<{ valid: boolean; brokenAtEventId?: string }> {
    const events = await this.dataSource
      .getRepository(AuditEvent)
      .find({ order: { seq: 'ASC' } });

    let prevHash: string | null = null;
    for (const event of events) {
      const expected = computeHash({
        accessLogId: event.accessLogId,
        eventType: event.eventType,
        actorUserId: event.actorUserId,
        metadata: event.metadata,
        createdAt: event.createdAt.toISOString(),
        prevHash,
      });
      if (expected !== event.hash || event.prevHash !== prevHash) {
        this.logger.error(`Audit chain broken at event ${event.id}`);
        return { valid: false, brokenAtEventId: event.id };
      }
      prevHash = event.hash;
    }
    return { valid: true };
  }
}
