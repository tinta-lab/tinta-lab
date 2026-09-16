import { AuditLogService } from './audit-log.service';
import { AuditEvent, AuditEventType } from './entities/audit-event.entity';

// Drives the real append()/verifyChain() code paths against an in-memory
// fake DataSource instead of a real Postgres connection — the hash-chain
// logic itself is what P1.2's "Chain Integrity" panel exposes, so this is
// the part worth exercising for real rather than mocking away.
function createFakeAuditStore() {
  const events: AuditEvent[] = [];
  let seqCounter = 0;

  const repo = {
    findOne: () =>
      Promise.resolve(events.length ? events[events.length - 1] : null),
    find: (opts: { where?: { accessLogId?: string } } = {}) => {
      const filtered = opts.where?.accessLogId
        ? events.filter((e) => e.accessLogId === opts.where!.accessLogId)
        : events;
      return Promise.resolve([...filtered]);
    },
    create: (data: Partial<AuditEvent>) => ({ ...data }) as AuditEvent,
    save: (event: AuditEvent) => {
      seqCounter += 1;
      const saved = {
        ...event,
        id: `evt-${seqCounter}`,
        seq: String(seqCounter),
      } as AuditEvent;
      events.push(saved);
      return Promise.resolve(saved);
    },
  };

  const fakeManager = {
    query: () => Promise.resolve(undefined), // pg_advisory_xact_lock — no-op outside a real transaction
    getRepository: () => repo,
  };

  const fakeDataSource = {
    transaction: async (
      cb: (manager: typeof fakeManager) => Promise<unknown>,
    ) => cb(fakeManager),
    getRepository: () => repo,
  };

  return { fakeDataSource, events };
}

describe('AuditLogService', () => {
  it('append() + verifyChain(): a chain built through normal appends verifies valid', async () => {
    const { fakeDataSource } = createFakeAuditStore();
    const service = new AuditLogService(fakeDataSource as never);

    await service.append('log-1', AuditEventType.GRANTED, 'user-1', {
      reason: 'client_toggle',
    });
    await service.append('log-1', AuditEventType.CONNECTED, 'user-1');
    await service.append('log-1', AuditEventType.REVOKED, 'user-1', {
      reason: 'manual',
    });

    await expect(service.verifyChain()).resolves.toEqual({ valid: true });
  });

  it('verifyChain(): detects a row mutated out from under the ledger', async () => {
    const { fakeDataSource, events } = createFakeAuditStore();
    const service = new AuditLogService(fakeDataSource as never);

    await service.append('log-1', AuditEventType.GRANTED, 'user-1', {
      reason: 'client_toggle',
    });
    await service.append('log-1', AuditEventType.CONNECTED, 'user-1');

    // The production DB blocks UPDATE/DELETE on audit_events with a trigger
    // (sql/001_access_hardening.sql) — this simulates that protection being
    // bypassed (e.g. a direct DB edit) so we can confirm verifyChain() would
    // still catch it rather than silently reporting a clean ledger.
    events[0].metadata = { reason: 'tampered' };

    const result = await service.verifyChain();
    expect(result.valid).toBe(false);
    expect(result.brokenAtEventId).toBe(events[0].id);
  });

  it('verifyChain(): an empty ledger is trivially valid', async () => {
    const { fakeDataSource } = createFakeAuditStore();
    const service = new AuditLogService(fakeDataSource as never);

    await expect(service.verifyChain()).resolves.toEqual({ valid: true });
  });

  it('getEventsForAccessLog(): returns only events for the requested session, in order', async () => {
    const { fakeDataSource } = createFakeAuditStore();
    const service = new AuditLogService(fakeDataSource as never);

    await service.append('log-1', AuditEventType.GRANTED, 'user-1');
    await service.append('log-2', AuditEventType.GRANTED, 'user-2');
    await service.append('log-1', AuditEventType.REVOKED, 'user-1');

    const events = await service.getEventsForAccessLog('log-1');
    expect(events.map((e) => e.eventType)).toEqual([
      AuditEventType.GRANTED,
      AuditEventType.REVOKED,
    ]);
  });
});
