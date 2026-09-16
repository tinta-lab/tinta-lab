import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { User, UserRole } from '../src/users/entities/user.entity';
import { Client } from '../src/clients/entities/client.entity';
import { Server } from '../src/servers/entities/server.entity';
import { AgentSession, AgentStatus } from '../src/tinta-core/entities/agent-session.entity';
import {
  assertNoForbiddenKeys,
  INFRA_SECRET_KEYS,
} from './helpers/assert-no-forbidden-keys';

// Hub contract-completeness cleanup (P1.4 backlog item): GET /hubs and
// GET /hubs/:id used to return a plain `Hub`/`HubAgent` TS interface — no
// OpenAPI schema (Record<string, never>) despite real, reachable data. This
// pins the actual HTTP response shape, not just that HubsService compiles
// against HubViewDto — same "check the real JSON, not just the DTO" lesson
// as P1.4-D1's oneOf fix. Runs against tinta_lab_test, never production.
jest.setTimeout(30_000);

describe('Hubs (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  let clientsRepo: Repository<Client>;
  let serversRepo: Repository<Server>;
  let sessionsRepo: Repository<AgentSession>;

  const PASSWORD = 'Test1234!';

  let adminToken: string;
  let supportToken: string;
  let clientId: string;
  let clientUserId: string;
  let staffUserId: string;
  let serverId: string;

  const createdUserIds: string[] = [];

  interface LoginBody {
    access_token: string;
  }

  function uniqueToken(): string {
    return randomUUID().slice(0, 8);
  }

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (res.body as LoginBody).access_token;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    usersRepo = moduleFixture.get(getRepositoryToken(User));
    clientsRepo = moduleFixture.get(getRepositoryToken(Client));
    serversRepo = moduleFixture.get(getRepositoryToken(Server));
    sessionsRepo = moduleFixture.get(getRepositoryToken(AgentSession));

    const hashed = await bcrypt.hash(PASSWORD, 12);
    const unique = uniqueToken();

    const clientUser = await usersRepo.save(
      usersRepo.create({
        email: `hubs-e2e-client-${unique}@example.test`,
        password: hashed,
        firstName: 'Hubs',
        lastName: 'ClientOwner',
        role: UserRole.CLIENT,
      }),
    );
    clientUserId = clientUser.id;
    createdUserIds.push(clientUser.id);

    const client = await clientsRepo.save(
      clientsRepo.create({
        user: clientUser,
        phone: '+49 151 0000002',
        city: 'Hamburg',
      }),
    );
    clientId = client.id;

    const server = await serversRepo.save(
      serversRepo.create({
        client,
        name: 'Hubs E2E Home',
        subdomain: `hubs-e2e-${unique}`,
        hubId: unique, // column is varchar(8) — `unique` is exactly 8 hex chars
        tunnelId: 'tunnel-secret-id',
        tunnelToken: 'tunnel-secret-token',
        cfAccessAppId: 'cf-access-app-secret',
        cfDnsRecordId: 'cf-dns-record-secret',
        localUrl: 'http://192.168.9.9:8123',
        haVersion: '2026.9.1',
      }),
    );
    serverId = server.id;

    await sessionsRepo.save(
      sessionsRepo.create({
        client,
        clientId: client.id,
        status: AgentStatus.CONNECTED,
        agentVersion: '2026.9.0',
        appliedTemplates: ['golden-1'],
        metrics: {
          cpuPercent: 10,
          memPercent: 20,
          diskPercent: 30,
          deviceCount: 5,
          automationCount: 2,
          uptimeSeconds: 12345,
        },
        installToken: 'install-token-e2e',
      }),
    );

    const adminEmail = `hubs-e2e-admin-${unique}@example.test`;
    const admin = await usersRepo.save(
      usersRepo.create({
        email: adminEmail,
        password: hashed,
        firstName: 'Hubs',
        lastName: 'Admin',
        role: UserRole.ADMIN,
      }),
    );
    createdUserIds.push(admin.id);

    const supportEmail = `hubs-e2e-support-${unique}@example.test`;
    const support = await usersRepo.save(
      usersRepo.create({
        email: supportEmail,
        password: hashed,
        firstName: 'Hubs',
        lastName: 'Support',
        role: UserRole.SUPPORT,
      }),
    );
    staffUserId = support.id;
    createdUserIds.push(support.id);

    adminToken = await loginAs(adminEmail);
    supportToken = await loginAs(supportEmail);
  });

  afterAll(async () => {
    await sessionsRepo.delete({ clientId });
    if (serverId) await serversRepo.delete(serverId);
    if (clientId) await clientsRepo.delete(clientId);
    if (createdUserIds.length) await usersRepo.delete(createdUserIds);
    await app.close();
  });

  describe('GET /hubs', () => {
    it('rejects non-ADMIN callers -> 403', async () => {
      await request(app.getHttpServer())
        .get('/hubs')
        .set('Authorization', `Bearer ${supportToken}`)
        .expect(403);
    });

    it('returns HubViewDto[] with real data, no infra secrets, no dead fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/hubs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const list = res.body as Record<string, unknown>[];
      const hub = list.find((h) => h.id === serverId);
      expect(hub).toBeDefined();

      // Real, used fields are present.
      expect(hub!.tunnelId).toBe('tunnel-secret-id');
      expect(hub!.localUrl).toBe('http://192.168.9.9:8123');
      expect((hub!.client as Record<string, unknown>).phone).toBe('+49 151 0000002');
      expect(
        ((hub!.client as Record<string, unknown>).user as Record<string, unknown>)
          .firstName,
      ).toBe('Hubs');
      expect((hub!.agent as Record<string, unknown>).isOnline).toBeDefined();
      expect(
        ((hub!.agent as Record<string, unknown>).metrics as Record<string, unknown>)
          .cpuPercent,
      ).toBe(10);

      // Confirmed-dead fields never appear, even though the underlying
      // entity columns are populated.
      expect(hub!.status).toBeUndefined();
      expect(hub!.subdomain).toBeUndefined();
      expect(hub!.cfAccessAppId).toBeUndefined();
      expect(((hub!.client as Record<string, unknown>).user as Record<string, unknown>).id).toBeUndefined();
      expect((hub!.agent as Record<string, unknown>).status).toBeUndefined();
      expect((hub!.agent as Record<string, unknown>).lastHeartbeatAt).toBeUndefined();
      expect(
        ((hub!.agent as Record<string, unknown>).metrics as Record<string, unknown>)
          .uptimeSeconds,
      ).toBeUndefined();

      // Real secrets — never in the response even for ADMIN. Excludes
      // tunnelId/localUrl from the shared INFRA_SECRET_KEYS profile: those
      // two ARE legitimately present here (see hub-view.dto.ts) — unlike
      // Server/Ticket, this endpoint has a real, audited use for them.
      assertNoForbiddenKeys(
        list,
        INFRA_SECRET_KEYS.filter((k) => k !== 'tunnelId' && k !== 'localUrl'),
      );
    });
  });

  describe('GET /hubs/:id', () => {
    it('rejects non-ADMIN callers -> 403', async () => {
      await request(app.getHttpServer())
        .get(`/hubs/${serverId}`)
        .set('Authorization', `Bearer ${supportToken}`)
        .expect(403);
    });

    it('returns 404 for a nonexistent hub', async () => {
      await request(app.getHttpServer())
        .get(`/hubs/${randomUUID()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('returns the same HubViewDto shape as the list, no infra secrets', async () => {
      const res = await request(app.getHttpServer())
        .get(`/hubs/${serverId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const hub = res.body as Record<string, unknown>;
      expect(hub.id).toBe(serverId);
      expect(hub.tunnelId).toBe('tunnel-secret-id');
      expect(hub.cfAccessAppId).toBeUndefined();
      assertNoForbiddenKeys(
        hub,
        INFRA_SECRET_KEYS.filter((k) => k !== 'tunnelId' && k !== 'localUrl'),
      );
    });
  });
});
