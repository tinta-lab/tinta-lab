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
import { Ticket, TicketType } from '../src/tickets/entities/ticket.entity';
import { TicketMessage } from '../src/tickets/entities/ticket-message.entity';
import { AccessLog } from '../src/access/entities/access-log.entity';
import {
  assertNoForbiddenKeys,
  STAFF_FORBIDDEN_KEYS,
} from './helpers/assert-no-forbidden-keys';

// Phase 0.2 (PHASE0_PHASE1_SPEC.md): GET /access/logs?clientId= must narrow
// results to one client's events, and — for STAFF (SUPPORT/SALES) callers —
// narrow *within* their existing ticket-scope rather than bypass it. Runs
// against tinta_lab_test, same as tickets-client-isolation.e2e-spec.ts.
jest.setTimeout(30_000);

describe('Access logs clientId filter (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  let clientsRepo: Repository<Client>;
  let serversRepo: Repository<Server>;
  let ticketsRepo: Repository<Ticket>;
  let messagesRepo: Repository<TicketMessage>;
  let accessLogsRepo: Repository<AccessLog>;

  const PASSWORD = 'Test1234!';

  interface ClientFixture {
    userId: string;
    clientId: string;
    serverId: string;
    token: string;
  }
  let clientA: ClientFixture;
  let clientB: ClientFixture;

  interface StaffFixture {
    userId: string;
    token: string;
  }
  let staffAdmin: StaffFixture;
  let staffSupport: StaffFixture;
  let staffSales: StaffFixture;

  interface LoginBody {
    access_token: string;
  }
  interface IdBody {
    id: string;
  }

  const createdTicketIds: string[] = [];
  const createdAccessLogIds: string[] = [];

  function uniqueToken(): string {
    return randomUUID().slice(0, 8);
  }

  async function createClientFixture(suffix: string): Promise<ClientFixture> {
    const unique = `${suffix}-${uniqueToken()}`;
    const email = `access-clientid-${unique}@example.test`;
    const hashed = await bcrypt.hash(PASSWORD, 12);

    const user = await usersRepo.save(
      usersRepo.create({
        email,
        password: hashed,
        firstName: 'Filter',
        lastName: suffix.toUpperCase(),
        role: UserRole.CLIENT,
      }),
    );
    const client = await clientsRepo.save(
      clientsRepo.create({ user, phone: '+49 151 0000001' }),
    );
    const server = await serversRepo.save(
      serversRepo.create({
        client,
        name: `Home ${suffix.toUpperCase()}`,
        subdomain: `access-clientid-${unique}`,
      }),
    );

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    const loginBody = loginRes.body as LoginBody;
    return {
      userId: user.id,
      clientId: client.id,
      serverId: server.id,
      token: loginBody.access_token,
    };
  }

  async function createStaffFixture(
    role: UserRole,
    suffix: string,
  ): Promise<StaffFixture> {
    const email = `access-clientid-staff-${suffix}-${uniqueToken()}@example.test`;
    const hashed = await bcrypt.hash(PASSWORD, 12);

    const user = await usersRepo.save(
      usersRepo.create({
        email,
        password: hashed,
        firstName: 'Staff',
        lastName: suffix.toUpperCase(),
        role,
      }),
    );

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    const loginBody = loginRes.body as LoginBody;
    return { userId: user.id, token: loginBody.access_token };
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
    ticketsRepo = moduleFixture.get(getRepositoryToken(Ticket));
    messagesRepo = moduleFixture.get(getRepositoryToken(TicketMessage));
    accessLogsRepo = moduleFixture.get(getRepositoryToken(AccessLog));

    clientA = await createClientFixture('a');
    clientB = await createClientFixture('b');
    staffAdmin = await createStaffFixture(UserRole.ADMIN, 'admin');
    staffSupport = await createStaffFixture(UserRole.SUPPORT, 'support');
    staffSales = await createStaffFixture(UserRole.SALES, 'sales');

    // Ticket owned by client A, so SUPPORT/SALES can gain ticket-scope over
    // it by posting a message on it (same mechanism access.service.ts's
    // queryAuditEvents STAFF scope uses: ticket_messages.authorId).
    const ticketRes = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${clientA.token}`)
      .send({
        type: TicketType.SUPPORT,
        subject: 'Access filter scope ticket',
        description: 'Used to grant SUPPORT/SALES ticket-scope over client A.',
        serverId: clientA.serverId,
      })
      .expect(201);
    const ticketABody = ticketRes.body as IdBody;
    createdTicketIds.push(ticketABody.id);

    await request(app.getHttpServer())
      .post(`/tickets/${ticketABody.id}/messages`)
      .set('Authorization', `Bearer ${staffSupport.token}`)
      .send({ message: 'Looking into this.', internal: false })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tickets/${ticketABody.id}/messages`)
      .set('Authorization', `Bearer ${staffSales.token}`)
      .send({ message: 'Confirming account details.', internal: true })
      .expect(201);

    // One audit event (GRANTED) per client, via ADMIN (bypasses ownership).
    const grantA = await request(app.getHttpServer())
      .post(`/access/grant/${clientA.serverId}`)
      .set('Authorization', `Bearer ${staffAdmin.token}`)
      .send({ ticketId: ticketABody.id })
      .expect(201);
    createdAccessLogIds.push((grantA.body as IdBody).id);

    const grantB = await request(app.getHttpServer())
      .post(`/access/grant/${clientB.serverId}`)
      .set('Authorization', `Bearer ${staffAdmin.token}`)
      .send({})
      .expect(201);
    createdAccessLogIds.push((grantB.body as IdBody).id);
  });

  afterAll(async () => {
    if (createdAccessLogIds.length) {
      await accessLogsRepo.delete(createdAccessLogIds);
    }
    if (createdTicketIds.length) {
      await messagesRepo.delete({ ticket: { id: createdTicketIds[0] } });
      await ticketsRepo.delete(createdTicketIds);
    }
    const serverIds = [clientA?.serverId, clientB?.serverId].filter(
      (id): id is string => !!id,
    );
    if (serverIds.length) await serversRepo.delete(serverIds);
    const clientIds = [clientA?.clientId, clientB?.clientId].filter(
      (id): id is string => !!id,
    );
    if (clientIds.length) await clientsRepo.delete(clientIds);
    const userIds = [
      clientA?.userId,
      clientB?.userId,
      staffAdmin?.userId,
      staffSupport?.userId,
      staffSales?.userId,
    ].filter((id): id is string => !!id);
    if (userIds.length) await usersRepo.delete(userIds);

    await app.close();
  });

  describe('GET /access/logs?clientId= as ADMIN', () => {
    it("returns only client A's events when filtered by A's clientId", async () => {
      const res = await request(app.getHttpServer())
        .get(`/access/logs?clientId=${clientA.clientId}`)
        .set('Authorization', `Bearer ${staffAdmin.token}`)
        .expect(200);

      const body = res.body as { data: { client: { id: string } | null }[] };
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data.every((e) => e.client?.id === clientA.userId)).toBe(
        true,
      );
    });

    it("returns only client B's events when filtered by B's clientId", async () => {
      const res = await request(app.getHttpServer())
        .get(`/access/logs?clientId=${clientB.clientId}`)
        .set('Authorization', `Bearer ${staffAdmin.token}`)
        .expect(200);

      const body = res.body as { data: { client: { id: string } | null }[] };
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data.every((e) => e.client?.id === clientB.userId)).toBe(
        true,
      );
    });

    it('a malformed clientId is a validation error, not a raw DB error', async () => {
      await request(app.getHttpServer())
        .get('/access/logs?clientId=not-a-uuid')
        .set('Authorization', `Bearer ${staffAdmin.token}`)
        .expect(400);
    });
  });

  describe('GET /access/logs?clientId= as SUPPORT — narrows within scope, never bypasses it', () => {
    it('client A is within scope (SUPPORT posted on their ticket) -> returns events', async () => {
      const res = await request(app.getHttpServer())
        .get(`/access/logs?clientId=${clientA.clientId}`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .expect(200);

      const body = res.body as { data: { client: { id: string } | null }[] };
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data.every((e) => e.client?.id === clientA.userId)).toBe(
        true,
      );
      assertNoForbiddenKeys(body, STAFF_FORBIDDEN_KEYS);
    });

    it('client B is outside scope -> 200 with an empty page, not 403', async () => {
      const res = await request(app.getHttpServer())
        .get(`/access/logs?clientId=${clientB.clientId}`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .expect(200);

      const body = res.body as { data: unknown[]; total: number };
      expect(body.data.length).toBe(0);
      expect(body.total).toBe(0);
    });
  });

  describe('GET /access/sessions/:accessLogId as SUPPORT/ADMIN — never leaks infra secrets', () => {
    it('SUPPORT (in ticket-scope) gets the session detail with no forbidden keys', async () => {
      const res = await request(app.getHttpServer())
        .get(`/access/sessions/${createdAccessLogIds[0]}`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .expect(200);

      const body = res.body as { id: string };
      expect(body.id).toBe(createdAccessLogIds[0]);
      assertNoForbiddenKeys(body, STAFF_FORBIDDEN_KEYS);
    });

    it('ADMIN gets the session detail with no forbidden keys', async () => {
      const res = await request(app.getHttpServer())
        .get(`/access/sessions/${createdAccessLogIds[0]}`)
        .set('Authorization', `Bearer ${staffAdmin.token}`)
        .expect(200);

      assertNoForbiddenKeys(res.body, STAFF_FORBIDDEN_KEYS);
    });
  });

  describe('GET /access/logs?clientId= as SALES — same scoping mechanism as SUPPORT', () => {
    it('client A is within scope (SALES posted an internal note on their ticket) -> returns events', async () => {
      const res = await request(app.getHttpServer())
        .get(`/access/logs?clientId=${clientA.clientId}`)
        .set('Authorization', `Bearer ${staffSales.token}`)
        .expect(200);

      const body = res.body as { data: { client: { id: string } | null }[] };
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data.every((e) => e.client?.id === clientA.userId)).toBe(
        true,
      );
    });

    it('client B is outside scope -> 200 with an empty page, not 403', async () => {
      const res = await request(app.getHttpServer())
        .get(`/access/logs?clientId=${clientB.clientId}`)
        .set('Authorization', `Bearer ${staffSales.token}`)
        .expect(200);

      const body = res.body as { data: unknown[]; total: number };
      expect(body.data.length).toBe(0);
      expect(body.total).toBe(0);
    });
  });
});
