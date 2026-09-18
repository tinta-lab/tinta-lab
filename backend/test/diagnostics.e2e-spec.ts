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
import { Server, ServerStatus } from '../src/servers/entities/server.entity';
import {
  assertNoForbiddenKeys,
  STAFF_FORBIDDEN_KEYS,
} from './helpers/assert-no-forbidden-keys';

// Verifies DiagnosticsService's real orchestration end to end: JWT ->
// assertCanView -> real Client/Server/AgentSession/Access/Templates/Audit
// data -> the 11 pure check functions -> aggregateStatus -> HTTP response.
// No AgentSession fixtures here have a live WebSocket connection (nothing
// in this suite drives a real Tinta Agent), so `agentOnline` is always
// false for every fixture — the "healthy client" case below asserts on
// count/shape/no-leak, not overallStatus: OK, since a genuinely all-green
// result would require faking a live agent socket, which is out of scope
// for this suite.
//
// Runs against tinta_lab_test, never tinta_lab.
jest.setTimeout(30_000);

describe('Diagnostics (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  let clientsRepo: Repository<Client>;
  let serversRepo: Repository<Server>;

  const PASSWORD = 'Test1234!';

  interface StaffFixture {
    userId: string;
    token: string;
  }
  let staffAdmin: StaffFixture;
  let staffSupport: StaffFixture;
  let staffClient: { userId: string; token: string }; // a CLIENT-role login, for the 403 test

  interface ClientFixture {
    userId: string;
    clientId: string;
    serverIds: string[];
  }
  const createdUserIds: string[] = [];
  const createdClientIds: string[] = [];
  const createdServerIds: string[] = [];

  function uniqueToken(): string {
    return randomUUID().slice(0, 8);
  }

  async function createUser(role: UserRole, prefix: string): Promise<User> {
    const email = `diag-${prefix}-${uniqueToken()}@example.test`;
    const hashed = await bcrypt.hash(PASSWORD, 12);
    const user = await usersRepo.save(
      usersRepo.create({
        email,
        password: hashed,
        firstName: 'Diag',
        lastName: prefix.toUpperCase(),
        role,
      }),
    );
    createdUserIds.push(user.id);
    return user;
  }

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (res.body as { access_token: string }).access_token;
  }

  async function createClientFixture(
    prefix: string,
    servers: Array<Partial<Server>>,
  ): Promise<ClientFixture> {
    const user = await createUser(UserRole.CLIENT, prefix);
    const client = await clientsRepo.save(
      clientsRepo.create({ user, phone: '+49 151 0000000' }),
    );
    createdClientIds.push(client.id);

    const serverIds: string[] = [];
    for (const [i, overrides] of servers.entries()) {
      const server = await serversRepo.save(
        serversRepo.create({
          client,
          name: `Diag server ${prefix} ${i}`,
          subdomain: `diag-${prefix}-${uniqueToken()}`,
          ...overrides,
        }),
      );
      serverIds.push(server.id);
      createdServerIds.push(server.id);
    }

    return { userId: user.id, clientId: client.id, serverIds };
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

    const adminUser = await createUser(UserRole.ADMIN, 'admin');
    staffAdmin = { userId: adminUser.id, token: await login(adminUser.email) };

    const supportUser = await createUser(UserRole.SUPPORT, 'support');
    staffSupport = {
      userId: supportUser.id,
      token: await login(supportUser.email),
    };

    const clientUser = await createUser(UserRole.CLIENT, 'roletest');
    staffClient = {
      userId: clientUser.id,
      token: await login(clientUser.email),
    };
  });

  afterAll(async () => {
    if (createdServerIds.length) await serversRepo.delete(createdServerIds);
    if (createdClientIds.length) await clientsRepo.delete(createdClientIds);
    if (createdUserIds.length) await usersRepo.delete(createdUserIds);
    await app.close();
  });

  describe('GET /clients/:clientId/diagnostics — ADMIN', () => {
    it('healthy-ish client (one ONLINE server, hub linked) -> 200, exactly 11 checks, no forbidden keys', async () => {
      const fixture = await createClientFixture('healthy', [
        {
          status: ServerStatus.ONLINE,
          hubId: 'hub1234',
          accessEnabled: false,
          // Deliberately set infra secrets, same technique as
          // tickets-client-isolation.e2e-spec.ts — an assertion that a
          // field is undefined only proves something if it was ever
          // populated in the first place.
          tunnelToken: 'secret-cf-tunnel-token',
          cfAccessAppId: 'secret-cf-access-app-id',
          cfDnsRecordId: 'secret-cf-dns-record-id',
          localUrl: 'http://192.168.1.50:8123',
        },
      ]);

      const res = await request(app.getHttpServer())
        .get(`/clients/${fixture.clientId}/diagnostics`)
        .set('Authorization', `Bearer ${staffAdmin.token}`)
        .expect(200);

      const body = res.body as {
        clientId: string;
        overallStatus: string;
        checks: { key: string; status: string }[];
        server: Record<string, unknown> | null;
        hub: Record<string, unknown> | null;
      };
      expect(body.clientId).toBe(fixture.clientId);
      expect(body.checks).toHaveLength(11);
      expect(new Set(body.checks.map((c) => c.key)).size).toBe(11);

      const serverCheck = body.checks.find((c) => c.key === 'server');
      expect(serverCheck?.status).toBe('ok'); // ONLINE
      const hubCheck = body.checks.find((c) => c.key === 'hub');
      expect(hubCheck?.status).toBe('ok'); // hubId set

      // Infra secrets never appear anywhere in the response, including the
      // top-level server ref.
      expect(body.server?.tunnelToken).toBeUndefined();
      expect(body.server?.cfAccessAppId).toBeUndefined();
      expect(body.server?.localUrl).toBeUndefined();
      assertNoForbiddenKeys(body, STAFF_FORBIDDEN_KEYS);
    });

    it('client with zero servers -> 200, overallStatus UNKNOWN, no-server semantics', async () => {
      const fixture = await createClientFixture('noserver', []);

      const res = await request(app.getHttpServer())
        .get(`/clients/${fixture.clientId}/diagnostics`)
        .set('Authorization', `Bearer ${staffAdmin.token}`)
        .expect(200);

      const body = res.body as {
        overallStatus: string;
        checks: { key: string; status: string; code: string }[];
        server: unknown;
        hub: unknown;
      };
      expect(body.overallStatus).toBe('unknown');
      expect(body.server).toBeNull();
      expect(body.hub).toBeNull();

      const hubCheck = body.checks.find((c) => c.key === 'hub');
      expect(hubCheck?.status).toBe('unknown');
      expect(hubCheck?.code).toBe('NO_SERVER');
      const serverCheck = body.checks.find((c) => c.key === 'server');
      expect(serverCheck?.status).toBe('unknown');
      expect(serverCheck?.code).toBe('NO_SERVER');

      // No check may be ERROR/WARNING for a brand-new, never-provisioned
      // client — §1's "UNKNOWN is not evidence of a fault" rule.
      expect(
        body.checks.every((c) => c.status === 'ok' || c.status === 'unknown'),
      ).toBe(true);
    });

    it('multi-server client -> deterministic representative server, multiServerDetected: true', async () => {
      const fixture = await createClientFixture('multi', [
        { status: ServerStatus.ONLINE, hubId: 'hubold1' },
        { status: ServerStatus.ONLINE, hubId: 'hubnew1' },
      ]);
      // Force an unambiguous createdAt order — the first server (already
      // the lower id in insertion order isn't guaranteed) must be strictly
      // older, matching the ORDER BY createdAt ASC, id ASC tie-break.
      await serversRepo.update(fixture.serverIds[0], {
        createdAt: new Date(Date.now() - 60_000),
      });

      const res = await request(app.getHttpServer())
        .get(`/clients/${fixture.clientId}/diagnostics`)
        .set('Authorization', `Bearer ${staffAdmin.token}`)
        .expect(200);

      const body = res.body as {
        server: { id: string } | null;
        checks: { key: string; evidence: Record<string, unknown> | null }[];
      };
      expect(body.server?.id).toBe(fixture.serverIds[0]);

      const serverCheck = body.checks.find((c) => c.key === 'server');
      expect(serverCheck?.evidence).toMatchObject({
        multiServerDetected: true,
      });
    });

    it('nonexistent client -> 404', async () => {
      await request(app.getHttpServer())
        .get(`/clients/${randomUUID()}/diagnostics`)
        .set('Authorization', `Bearer ${staffAdmin.token}`)
        .expect(404);
    });
  });

  describe('GET /clients/:clientId/diagnostics — SUPPORT ownership (§2)', () => {
    it('SUPPORT with an accessEnabled server -> 200', async () => {
      const fixture = await createClientFixture('supportok', [
        { status: ServerStatus.ONLINE, accessEnabled: true },
      ]);

      await request(app.getHttpServer())
        .get(`/clients/${fixture.clientId}/diagnostics`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .expect(200);
    });

    it('SUPPORT with no accessEnabled server -> 403', async () => {
      const fixture = await createClientFixture('supportdenied', [
        { status: ServerStatus.ONLINE, accessEnabled: false },
      ]);

      await request(app.getHttpServer())
        .get(`/clients/${fixture.clientId}/diagnostics`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .expect(403);
    });

    it('SUPPORT for a client with zero servers -> 403 (nothing to grant access on)', async () => {
      const fixture = await createClientFixture('supportnoserver', []);

      await request(app.getHttpServer())
        .get(`/clients/${fixture.clientId}/diagnostics`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .expect(403);
    });
  });

  describe('GET /clients/:clientId/diagnostics — CLIENT role', () => {
    it('CLIENT -> 403 (not in DIAGNOSTICS_ROLES)', async () => {
      const fixture = await createClientFixture('clientrole', [
        { status: ServerStatus.ONLINE },
      ]);

      await request(app.getHttpServer())
        .get(`/clients/${fixture.clientId}/diagnostics`)
        .set('Authorization', `Bearer ${staffClient.token}`)
        .expect(403);
    });
  });
});
