import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AuditLogService } from '../src/access/audit-log.service';
import { AuditEventType } from '../src/access/entities/audit-event.entity';
import { NotificationsService } from '../src/notifications/notifications.service';
import { NotificationDispatcher } from '../src/notifications/notification-dispatcher';
import {
  TelegramSender,
  SendResult,
} from '../src/notifications/telegram-sender';
import { TintaAgentGateway } from '../src/tinta-core/tinta-agent.gateway';

// Transactional outbox for Telegram notifications, against a real Postgres
// (tinta_lab_test). Telegram itself is faked; the dispatcher's own interval
// and kick are switched off so every delivery happens when the test says.
// Acceptance: a security alert committed with its audit event survives a
// backend restart and Telegram failures; failures end as visible 'failed'
// rows; parallel dispatchers never send the same row twice.
jest.setTimeout(60_000);

type FakeSender = {
  configured: boolean;
  send: jest.Mock; // (kind: string, html: string) => Promise<SendResult>
};

const ok = (): Promise<SendResult> =>
  Promise.resolve({ ok: true, httpAttempts: 1, errorCode: null });
const down = (): Promise<SendResult> =>
  Promise.resolve({ ok: false, httpAttempts: 3, errorCode: 'network' });

async function boot(sender: FakeSender): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TelegramSender)
    .useValue(sender)
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  app.get(SchedulerRegistry).deleteInterval('notification-dispatch');
  jest
    .spyOn(app.get(NotificationDispatcher), 'kick')
    .mockImplementation(() => undefined);
  return app;
}

describe('Notification outbox (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let sender: FakeSender;

  const dispatcher = () => app.get(NotificationDispatcher);
  const rows = (where = 'true', params: unknown[] = []) =>
    ds.query(
      `SELECT * FROM notification_outbox WHERE ${where} ORDER BY "createdAt"`,
      params,
    );
  const attemptsOf = (id: string) =>
    ds.query(
      `SELECT outcome, "errorCode" FROM notification_attempts WHERE "notificationId" = $1 ORDER BY id`,
      [id],
    );
  const makeDue = () =>
    ds.query(
      `UPDATE notification_outbox SET "nextAttemptAt" = now() WHERE status = 'pending'`,
    );
  const provisioning = {
    clientName: 'Max',
    clientEmail: 'max@example.test',
    serverName: 'Haus',
    subdomain: 'haus.example.test',
    dashboardUrl: 'https://haus.example.test',
  };

  beforeAll(async () => {
    sender = { configured: true, send: jest.fn(ok) };
    app = await boot(sender);
    ds = app.get(DataSource);
  });

  afterAll(async () => {
    await ds.query('DELETE FROM notification_outbox');
    await app.close();
  });

  beforeEach(async () => {
    await ds.query('DELETE FROM notification_outbox');
    sender.configured = true;
    sender.send.mockReset().mockImplementation(ok);
  });

  describe('security anomaly + alert are one transaction', () => {
    it('commits the audit event and the queued alert together', async () => {
      const accessLogId = randomUUID();
      await app
        .get(TintaAgentGateway)
        .recordSecurityAnomaly(accessLogId, [
          { type: 'new_admin', detail: 'evil_admin' },
        ]);

      const audit = await ds.query(
        `SELECT id FROM audit_events WHERE "accessLogId" = $1 AND "eventType" = $2`,
        [accessLogId, AuditEventType.SECURITY_ANOMALY],
      );
      expect(audit).toHaveLength(1);
      const queued = await rows(`payload->>'accessLogId' = $1`, [accessLogId]);
      expect(queued).toHaveLength(1);
      expect(queued[0]).toMatchObject({
        eventType: 'security_anomaly',
        priority: 0,
        status: 'pending',
        maxAttempts: 10,
      });
    });

    it('rolls both back when the in-transaction step fails', async () => {
      const accessLogId = randomUUID();
      await expect(
        app
          .get(AuditLogService)
          .append(
            accessLogId,
            AuditEventType.SECURITY_ANOMALY,
            null,
            {},
            async (m) => {
              await app
                .get(NotificationsService)
                .enqueue(
                  'security_anomaly',
                  {
                    clientName: null,
                    serverName: null,
                    accessLogId,
                    anomalies: [],
                  },
                  m,
                );
              throw new Error('boom after enqueue');
            },
          ),
      ).rejects.toThrow('boom after enqueue');

      expect(
        await ds.query(`SELECT 1 FROM audit_events WHERE "accessLogId" = $1`, [
          accessLogId,
        ]),
      ).toHaveLength(0);
      expect(
        await rows(`payload->>'accessLogId' = $1`, [accessLogId]),
      ).toHaveLength(0);
    });

    it('still records the audit event when the alert cannot be queued', async () => {
      const accessLogId = randomUUID();
      const enqueue = jest
        .spyOn(app.get(NotificationsService), 'enqueue')
        .mockRejectedValueOnce(new Error('outbox unavailable'));
      try {
        await app
          .get(TintaAgentGateway)
          .recordSecurityAnomaly(accessLogId, [{ type: 't', detail: 'd' }]);
      } finally {
        enqueue.mockRestore();
      }
      expect(
        await ds.query(`SELECT 1 FROM audit_events WHERE "accessLogId" = $1`, [
          accessLogId,
        ]),
      ).toHaveLength(1);
      expect(await rows()).toHaveLength(0);
    });
  });

  describe('dispatch', () => {
    it('delivers, records the attempt, and puts the short id in the message', async () => {
      const id = await app
        .get(NotificationsService)
        .enqueue('provisioning_complete', provisioning);

      expect(await dispatcher().tick()).toBe(1);

      const [row] = await rows();
      expect(row).toMatchObject({
        status: 'sent',
        attempts: 1,
        lockedUntil: null,
      });
      expect(row.sentAt).toBeInstanceOf(Date);
      expect(await attemptsOf(id)).toEqual([
        { outcome: 'sent', errorCode: null },
      ]);
      expect(sender.send.mock.calls[0][1]).toContain(`#${id.slice(0, 8)}`);
    });

    it('retries with backoff and ends as a visible failure after maxAttempts', async () => {
      sender.send.mockImplementation(down);
      const id = await app
        .get(NotificationsService)
        .enqueue('provisioning_complete', provisioning); // maxAttempts 3

      await dispatcher().tick();
      let [row] = await rows();
      expect(row).toMatchObject({
        status: 'pending',
        attempts: 1,
        lastErrorCode: 'network',
      });
      const waitS = (new Date(row.nextAttemptAt).getTime() - Date.now()) / 1000;
      expect(waitS).toBeGreaterThan(50); // backoff 1 min
      expect(await dispatcher().tick()).toBe(0); // not due yet

      await makeDue();
      await dispatcher().tick();
      await makeDue();
      await dispatcher().tick();

      [row] = await rows();
      expect(row).toMatchObject({
        status: 'failed',
        attempts: 3,
        lastErrorCode: 'network',
      });
      expect(
        (await attemptsOf(id)).map((a: { outcome: string }) => a.outcome),
      ).toEqual(['retry', 'retry', 'failed']);
    });

    it('sends the most urgent first', async () => {
      const notifications = app.get(NotificationsService);
      await notifications.enqueue('provisioning_complete', provisioning);
      await notifications.enqueue('security_anomaly', {
        clientName: 'c',
        serverName: 's',
        accessLogId: randomUUID(),
        anomalies: [],
      });
      await dispatcher().tick();
      expect(sender.send.mock.calls.map((c) => c[0])).toEqual([
        'security_anomaly',
        'provisioning_complete',
      ]);
    });

    it('leaves everything queued while Telegram is not configured', async () => {
      sender.configured = false;
      await app
        .get(NotificationsService)
        .enqueue('provisioning_complete', provisioning);
      expect(await dispatcher().tick()).toBe(0);
      expect(sender.send).not.toHaveBeenCalled();
      expect((await rows())[0]).toMatchObject({
        status: 'pending',
        attempts: 0,
      });
    });
  });

  describe('crashes and restarts', () => {
    it('a queued security alert survives a backend restart and is delivered after it', async () => {
      sender.send.mockImplementation(down);
      const accessLogId = randomUUID();
      await app
        .get(TintaAgentGateway)
        .recordSecurityAnomaly(accessLogId, [
          { type: 'new_admin', detail: 'x' },
        ]);
      await dispatcher().tick(); // Telegram down → stays queued

      // "Restart": a whole new application instance on the same database.
      const sender2: FakeSender = { configured: true, send: jest.fn(ok) };
      const app2 = await boot(sender2);
      try {
        await makeDue();
        expect(await app2.get(NotificationDispatcher).tick()).toBe(1);
      } finally {
        await app2.close();
      }
      const [row] = await rows(`payload->>'accessLogId' = $1`, [accessLogId]);
      expect(row).toMatchObject({ status: 'sent', attempts: 2 });
      expect(sender2.send).toHaveBeenCalledTimes(1);
    });

    it('reclaims a notification whose sender died mid-send (expired lease)', async () => {
      const id = await app
        .get(NotificationsService)
        .enqueue('security_anomaly', {
          clientName: 'c',
          serverName: 's',
          accessLogId: randomUUID(),
          anomalies: [],
        });
      // As left behind by a process that claimed it and crashed.
      await ds.query(
        `UPDATE notification_outbox SET status = 'processing', attempts = 1,
                "lockedUntil" = now() - interval '1 minute' WHERE id = $1`,
        [id],
      );

      expect(await dispatcher().tick()).toBe(1);
      expect((await rows())[0]).toMatchObject({ status: 'sent', attempts: 2 });
    });

    it('does not reclaim a lease that is still valid', async () => {
      const id = await app
        .get(NotificationsService)
        .enqueue('provisioning_complete', provisioning);
      await ds.query(
        `UPDATE notification_outbox SET status = 'processing', attempts = 1,
                "lockedUntil" = now() + interval '1 minute' WHERE id = $1`,
        [id],
      );
      expect(await dispatcher().tick()).toBe(0);
    });

    it('marks a crashed final attempt as failed instead of exceeding the policy', async () => {
      const id = await app
        .get(NotificationsService)
        .enqueue('provisioning_complete', provisioning);
      await ds.query(
        `UPDATE notification_outbox SET status = 'processing', attempts = 3,
                "lockedUntil" = now() - interval '1 minute' WHERE id = $1`,
        [id],
      );
      await dispatcher().tick();
      expect(sender.send).not.toHaveBeenCalled();
      expect((await rows())[0]).toMatchObject({
        status: 'failed',
        lastErrorCode: 'abandoned',
      });
      expect(await attemptsOf(id)).toEqual([
        { outcome: 'failed', errorCode: 'abandoned' },
      ]);
    });
  });

  it('two dispatchers working the same queue never send a row twice', async () => {
    const notifications = app.get(NotificationsService);
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) {
      ids.push(
        await notifications.enqueue('provisioning_complete', provisioning),
      );
    }
    const slow = (): Promise<SendResult> =>
      new Promise((r) =>
        setTimeout(() => r({ ok: true, httpAttempts: 1, errorCode: null }), 20),
      );
    sender.send.mockImplementation(slow);
    const sender2: FakeSender = { configured: true, send: jest.fn(slow) };
    const second = new NotificationDispatcher(
      ds,
      sender2 as unknown as TelegramSender,
    );

    const [a, b] = await Promise.all([dispatcher().tick(), second.tick()]);

    expect(a + b).toBe(12);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    const sentIds = [...sender.send.mock.calls, ...sender2.send.mock.calls].map(
      (c) => /#([0-9a-f]{8})/.exec(c[1])![1],
    );
    expect(new Set(sentIds).size).toBe(12);
    const counts = await ds.query(
      `SELECT count(*)::int AS n FROM notification_attempts WHERE "notificationId" = ANY($1) GROUP BY "notificationId"`,
      [ids],
    );
    expect(counts.every((c: { n: number }) => c.n === 1)).toBe(true);
  });

  it('a Postgres failure during dispatch is logged, not thrown, and loses nothing', async () => {
    const broken = new NotificationDispatcher(
      {
        query: () => Promise.reject(new Error('connection terminated')),
      } as unknown as DataSource,
      sender as unknown as TelegramSender,
    );
    await app
      .get(NotificationsService)
      .enqueue('provisioning_complete', provisioning);
    await expect(broken.tick()).resolves.toBe(0);
    expect((await rows())[0]).toMatchObject({ status: 'pending' });
  });
});
