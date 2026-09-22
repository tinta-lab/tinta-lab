import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
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
import { assertNoForbiddenKeys } from './helpers/assert-no-forbidden-keys';

// Regression coverage for the install-token consumption bug: GET
// /install/:token used to be the ONLY way to read serverName/
// externalUrl for display, but that same call also consumed the one-time
// install token (tinta-core.service.ts consumeInstallToken()). The frontend
// called it right after consent to render the page, which killed the token
// long before the human had even installed the HA add-on — so the Agent's
// own later enrollment call always got a 404. This suite pins the fix: a
// non-consuming GET /install/:token/preview for the browser, leaving GET
// /install/:token exclusively for the Agent's real (consuming) enrollment.
// Runs against tinta_lab_test, never production.
jest.setTimeout(30_000);

describe('Install flow (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  let clientsRepo: Repository<Client>;
  let serversRepo: Repository<Server>;
  let sessionsRepo: Repository<AgentSession>;

  let clientId: string;
  let serverId: string;
  const createdUserIds: string[] = [];

  function uniqueToken(): string {
    return randomUUID().slice(0, 8);
  }

  // Fresh client + server + not-yet-consented agent session per test, so
  // one test's token consumption can never leak into another's assertions.
  async function makeSession(): Promise<{ token: string; clientId: string }> {
    const unique = uniqueToken();
    const hashed = await bcrypt.hash('Test1234!', 12);
    const user = await usersRepo.save(
      usersRepo.create({
        email: `install-e2e-${unique}@example.test`,
        password: hashed,
        firstName: 'Install',
        lastName: 'E2E',
        role: UserRole.CLIENT,
      }),
    );
    createdUserIds.push(user.id);

    const client = await clientsRepo.save(
      clientsRepo.create({ user, phone: '+49 151 0000003', city: 'Berlin' }),
    );

    const server = await serversRepo.save(
      serversRepo.create({
        client,
        name: 'Install E2E Home',
        subdomain: `install-e2e-${unique}`,
        hubId: unique, // varchar(8) — `unique` is exactly 8 hex chars
        tunnelToken: 'tunnel-secret-token',
        localUrl: 'http://192.168.9.9:8123',
      }),
    );
    serverId = server.id;

    const token = randomUUID();
    await sessionsRepo.save(
      sessionsRepo.create({
        client,
        clientId: client.id,
        status: AgentStatus.DISCONNECTED,
        agentToken: 'agent-secret-jwt',
        installToken: token,
        installTokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        appliedTemplates: [],
      }),
    );

    return { token, clientId: client.id };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    usersRepo = moduleFixture.get(getRepositoryToken(User));
    clientsRepo = moduleFixture.get(getRepositoryToken(Client));
    serversRepo = moduleFixture.get(getRepositoryToken(Server));
    sessionsRepo = moduleFixture.get(getRepositoryToken(AgentSession));
  });

  afterEach(async () => {
    if (clientId) {
      await sessionsRepo.delete({ clientId });
      if (serverId) await serversRepo.delete(serverId);
      await clientsRepo.delete(clientId);
    }
  });

  afterAll(async () => {
    if (createdUserIds.length) await usersRepo.delete(createdUserIds);
    await app.close();
  });

  it('preview is gated behind consent, same as the Agent endpoint', async () => {
    const { token, clientId: cid } = await makeSession();
    clientId = cid;

    await request(app.getHttpServer()).get(`/install/${token}/preview`).expect(403);
    await request(app.getHttpServer()).get(`/install/${token}`).expect(403);
  });

  it('the core regression: preview never consumes the token, only the Agent endpoint does', async () => {
    const { token, clientId: cid } = await makeSession();
    clientId = cid;

    await request(app.getHttpServer())
      .post(`/install/${token}/consent`)
      .expect(200)
      .expect({ ok: true });

    // Preview — called twice, as the browser's initial load + a manual
    // reload would — must never touch installToken.
    for (let i = 0; i < 2; i++) {
      const res = await request(app.getHttpServer())
        .get(`/install/${token}/preview`)
        .expect(200);
      expect(res.body).toMatchObject({
        serverName: 'Install E2E Home',
        externalUrl: expect.any(String),
        expiresAt: expect.any(String),
      });
      assertNoForbiddenKeys(res.body, ['agentToken', 'tunnelToken', 'clientId']);
    }

    const stillLive = await sessionsRepo.findOne({ where: { clientId } });
    expect(stillLive?.installToken).toBe(token);

    // Agent's real enrollment call — this is the only call allowed to
    // consume the token, and it must hand back the actual secrets preview
    // withheld.
    const enrollRes = await request(app.getHttpServer())
      .get(`/install/${token}`)
      .expect(200);
    expect(enrollRes.body).toMatchObject({
      clientId,
      agentToken: 'agent-secret-jwt',
      tunnelToken: 'tunnel-secret-token',
    });

    const consumed = await sessionsRepo.findOne({ where: { clientId } });
    expect(consumed?.installToken).toBeNull();

    // Replay of either endpoint must now fail — the link is dead.
    await request(app.getHttpServer()).get(`/install/${token}`).expect(404);
    await request(app.getHttpServer()).get(`/install/${token}/preview`).expect(404);
  });

  it('unknown token: both endpoints 404', async () => {
    await request(app.getHttpServer()).get(`/install/${randomUUID()}/preview`).expect(404);
    await request(app.getHttpServer()).get(`/install/${randomUUID()}`).expect(404);
  });
});
