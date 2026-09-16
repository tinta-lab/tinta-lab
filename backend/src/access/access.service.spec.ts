import { AccessService } from './access.service';
import { AuditLogService } from './audit-log.service';
import { AuditEvent, AuditEventType } from './entities/audit-event.entity';

// Same in-memory fake used by audit-log.service.spec.ts — reused here (not
// mocked away) so grant/revoke tests also prove the real audit trail gets
// written, not just that the "current state" row changes.
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
    query: () => Promise.resolve(undefined),
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

interface FakeAccessLogRow {
  id: string;
  server: { id: string };
  grantedBy?: { id: string };
  grantedAt: Date;
  expiresAt: Date;
  isRevoked: boolean;
  revokedAt: Date | null;
  supportPassword: string | null;
  reasonCode: string | null;
  reasonDetails: string | null;
  ticket?: { id: string };
}

function createFakeAccessLogRepo() {
  const rows: FakeAccessLogRow[] = [];
  let idCounter = 0;
  return {
    rows,
    create: (data: Partial<FakeAccessLogRow>) =>
      ({ isRevoked: false, revokedAt: null, ...data }) as FakeAccessLogRow,
    save: (entity: FakeAccessLogRow) => {
      idCounter += 1;
      const saved = { ...entity, id: `log-${idCounter}` };
      rows.push(saved);
      return Promise.resolve(saved);
    },
    findOne: ({
      where,
    }: {
      where: { server: { id: string }; isRevoked: boolean };
    }) => {
      const matches = rows
        .filter(
          (r) =>
            r.server.id === where.server.id && r.isRevoked === where.isRevoked,
        )
        .sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime());
      return Promise.resolve(matches[0] ?? null);
    },
    update: (
      filter: { server: { id: string }; isRevoked: boolean },
      patch: Partial<FakeAccessLogRow>,
    ) => {
      rows
        .filter(
          (r) =>
            r.server.id === filter.server.id &&
            r.isRevoked === filter.isRevoked,
        )
        .forEach((r) => Object.assign(r, patch));
      return Promise.resolve();
    },
  };
}

const TEST_SERVER = {
  id: 'server-1',
  name: 'Home — Test',
  subdomain: 'test',
  client: {
    id: 'client-1',
    user: { firstName: 'Test', lastName: 'Client', email: 't@example.com' },
  },
};

function createServersServiceMock(
  overrides: { accessEnabled?: boolean; accessExpiresAt?: Date | null } = {},
) {
  return {
    setAccessEnabled: jest.fn(() => Promise.resolve(undefined)),
    findById: jest.fn(() => Promise.resolve(TEST_SERVER)),
    findAll: jest.fn(() =>
      Promise.resolve([
        {
          ...TEST_SERVER,
          accessEnabled: overrides.accessEnabled ?? false,
          accessExpiresAt: overrides.accessExpiresAt ?? null,
        },
      ]),
    ),
  };
}

const configServiceMock = { get: (_key: string, fallback: number) => fallback };

describe('AccessService — grant/revoke/expiration lifecycle', () => {
  it('grantAccess(): enables the server, creates a log, and appends a GRANTED audit event', async () => {
    const { fakeDataSource, events } = createFakeAuditStore();
    const auditLog = new AuditLogService(fakeDataSource as never);
    const accessLogRepository = createFakeAccessLogRepo();
    const serversService = createServersServiceMock();

    const service = new AccessService(
      accessLogRepository as never,
      {} as never,
      serversService as never,
      configServiceMock as never,
      auditLog,
      undefined as never,
      undefined as never,
    );

    const log = await service.grantAccess('server-1', 'staff-1', {
      reasonCode: 'client_toggle' as never,
    });

    expect(serversService.setAccessEnabled).toHaveBeenCalledWith(
      'server-1',
      true,
      expect.any(Date),
    );
    expect(log.isRevoked).toBe(false);
    expect(log.supportPassword).toBeTruthy();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(AuditEventType.GRANTED);
    expect(events[0].accessLogId).toBe(log.id);
  });

  it('revokeAccess(): disables the server, marks the log revoked, and appends a REVOKED audit event', async () => {
    const { fakeDataSource, events } = createFakeAuditStore();
    const auditLog = new AuditLogService(fakeDataSource as never);
    const accessLogRepository = createFakeAccessLogRepo();
    const serversService = createServersServiceMock();

    const service = new AccessService(
      accessLogRepository as never,
      {} as never,
      serversService as never,
      configServiceMock as never,
      auditLog,
      undefined as never,
      undefined as never,
    );

    const log = await service.grantAccess('server-1', 'staff-1');
    await service.revokeAccess('server-1', 'manual', 'staff-1');

    expect(serversService.setAccessEnabled).toHaveBeenLastCalledWith(
      'server-1',
      false,
    );
    expect(accessLogRepository.rows[0].isRevoked).toBe(true);
    expect(accessLogRepository.rows[0].supportPassword).toBeNull();
    expect(events).toHaveLength(2);
    expect(events[1].eventType).toBe(AuditEventType.REVOKED);
    expect(events[1].accessLogId).toBe(log.id);
  });

  it('checkAndRevokeExpired(): revokes a server whose accessExpiresAt has passed', async () => {
    const { fakeDataSource, events } = createFakeAuditStore();
    const auditLog = new AuditLogService(fakeDataSource as never);
    const accessLogRepository = createFakeAccessLogRepo();
    const serversService = createServersServiceMock({
      accessEnabled: true,
      accessExpiresAt: new Date(Date.now() - 60_000), // 1 minute in the past
    });
    // Pre-seed an open log the way grantAccess would have left one.
    await accessLogRepository.save(
      accessLogRepository.create({
        server: { id: 'server-1' },
        grantedAt: new Date(Date.now() - 3600_000),
        expiresAt: new Date(Date.now() - 60_000),
        supportPassword: 'pw',
        reasonCode: null,
        reasonDetails: null,
      }),
    );

    const service = new AccessService(
      accessLogRepository as never,
      {} as never,
      serversService as never,
      configServiceMock as never,
      auditLog,
      undefined as never,
      undefined as never,
    );

    await service.checkAndRevokeExpired();

    expect(serversService.setAccessEnabled).toHaveBeenCalledWith(
      'server-1',
      false,
    );
    expect(accessLogRepository.rows[0].isRevoked).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(AuditEventType.EXPIRED);
  });

  it('checkAndRevokeExpired(): leaves a server alone while its access is still within the window', async () => {
    const { fakeDataSource, events } = createFakeAuditStore();
    const auditLog = new AuditLogService(fakeDataSource as never);
    const accessLogRepository = createFakeAccessLogRepo();
    const serversService = createServersServiceMock({
      accessEnabled: true,
      accessExpiresAt: new Date(Date.now() + 3600_000), // 1 hour from now
    });

    const service = new AccessService(
      accessLogRepository as never,
      {} as never,
      serversService as never,
      configServiceMock as never,
      auditLog,
      undefined as never,
      undefined as never,
    );

    await service.checkAndRevokeExpired();

    expect(serversService.setAccessEnabled).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
  });
});
