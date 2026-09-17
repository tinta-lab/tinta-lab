import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { User, UserRole } from '../src/users/entities/user.entity';
import { Client } from '../src/clients/entities/client.entity';
import { Server } from '../src/servers/entities/server.entity';
import {
  Ticket,
  TicketStatus,
  TicketType,
} from '../src/tickets/entities/ticket.entity';
import { TicketMessage } from '../src/tickets/entities/ticket-message.entity';
import { AccessLog } from '../src/access/entities/access-log.entity';
import {
  assertNoForbiddenKeys,
  CLIENT_FORBIDDEN_KEYS,
  STAFF_FORBIDDEN_KEYS,
} from './helpers/assert-no-forbidden-keys';

// Verifies the CLIENT-scoped ticket API's actual security boundary end to
// end: JWT -> resolved clientId -> ownership check -> HTTP response. Two
// fully separate client accounts (A and B) are seeded directly through
// repositories (fast, no dependency on the provisioning flow); every
// assertion below is either "A can do X to A's own data" or "A must NOT be
// able to do X to B's data".
//
// Runs against tinta_lab_test (see package.json test:e2e), never tinta_lab —
// this suite creates real users/clients/servers/tickets and must not touch
// the production database.
// Real app boot (module graph + DB connection) + bcrypt-hashed logins run
// well past Jest's default 5s hook timeout.
jest.setTimeout(30_000);

describe('Tickets client isolation (e2e)', () => {
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
  let staffSupport: StaffFixture;
  let staffAdmin: StaffFixture;
  let staffSales: StaffFixture;

  // supertest types response bodies as `any` — these narrow just enough to
  // satisfy no-unsafe-* without asserting the full API response shape.
  interface LoginBody {
    access_token: string;
  }
  interface IdBody {
    id: string;
  }
  interface TicketListItem {
    id: string;
  }

  // Populated as the suite runs, used by afterAll for cleanup.
  const createdTicketIds: string[] = [];
  const createdAccessLogIds: string[] = [];

  // Short (8 hex chars, not a full 36-char UUID) — @IsEmail() enforces
  // RFC 5321's 64-char local-part limit, and "ticket-isolation-staff-<role>-"
  // plus a full UUID pushed staff fixture emails past it while client
  // fixtures (shorter prefix) happened to stay under. Keeping every fixture
  // email on the same short-token scheme avoids re-tripping this by luck.
  function uniqueToken(): string {
    return randomUUID().slice(0, 8);
  }

  async function createClientFixture(suffix: string): Promise<ClientFixture> {
    const unique = `${suffix}-${uniqueToken()}`;
    const email = `ticket-isolation-${unique}@example.test`;
    const hashed = await bcrypt.hash(PASSWORD, 12);

    const user = await usersRepo.save(
      usersRepo.create({
        email,
        password: hashed,
        firstName: 'Isolation',
        lastName: suffix.toUpperCase(),
        role: UserRole.CLIENT,
      }),
    );
    const client = await clientsRepo.save(
      clientsRepo.create({ user, phone: '+49 151 0000000' }),
    );
    const server = await serversRepo.save(
      serversRepo.create({
        client,
        name: `Home ${suffix.toUpperCase()}`,
        subdomain: `ticket-isolation-${unique}`,
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
    const email = `ticket-isolation-staff-${suffix}-${uniqueToken()}@example.test`;
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
    // Mirrors main.ts's bootstrap() pipe config — the isolation properties
    // under test (400 on missing serverId, forbidNonWhitelisted rejecting a
    // spoofed clientId/internal) only hold with this exact pipe applied.
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
    staffSupport = await createStaffFixture(UserRole.SUPPORT, 'support');
    staffAdmin = await createStaffFixture(UserRole.ADMIN, 'admin');
    staffSales = await createStaffFixture(UserRole.SALES, 'sales');
  });

  afterAll(async () => {
    // Defensive against a partially-failed beforeAll (e.g. one fixture's
    // login rejects): each step uses optional chaining + a filtered id list
    // instead of assuming every fixture var got assigned, so one undefined
    // fixture can't throw mid-array-literal and skip every step after it —
    // that's exactly how a bad run once left orphaned rows behind here.
    // FK order: access_logs -> messages -> tickets -> servers -> clients -> users.
    if (createdAccessLogIds.length) {
      await accessLogsRepo.delete(createdAccessLogIds);
    }
    if (createdTicketIds.length) {
      await messagesRepo.delete({ ticket: In(createdTicketIds) });
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
      staffSupport?.userId,
      staffAdmin?.userId,
      staffSales?.userId,
    ].filter((id): id is string => !!id);
    if (userIds.length) await usersRepo.delete(userIds);

    await app.close();
  });

  describe('POST /tickets', () => {
    it("creates a ticket against the caller's own server -> 201", async () => {
      const res = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${clientA.token}`)
        .send({
          type: TicketType.SUPPORT,
          subject: 'Lights not working',
          description: 'Living room lights stopped responding.',
          serverId: clientA.serverId,
        })
        .expect(201);

      const body = res.body as Record<string, unknown> & {
        server: Record<string, unknown> | null;
      };
      expect(body.id).toBeDefined();
      createdTicketIds.push(body.id as string);

      // Response is ClientTicketView, not the raw Ticket entity — the
      // submitter-identity and staff-only fields the entity carries
      // (name/email/phone/client/assignedTo/internalNotes) must be absent,
      // not just unpopulated.
      expect(body.subject).toBe('Lights not working');
      expect(body.name).toBeUndefined();
      expect(body.email).toBeUndefined();
      expect(body.phone).toBeUndefined();
      expect(body.client).toBeUndefined();
      expect(body.assignedTo).toBeUndefined();
      expect(body.internalNotes).toBeUndefined();
      expect(body.server?.id).toBe(clientA.serverId);
      expect(body.server?.name).toBeDefined();
      expect(body.server?.tunnelToken).toBeUndefined();

      const row = await ticketsRepo.findOne({
        where: { id: body.id as string },
        relations: ['client', 'server'],
      });
      expect(row?.client?.id).toBe(clientA.clientId);
      expect(row?.server?.id).toBe(clientA.serverId);
    });

    it('rejects a serverId belonging to another client -> 403', async () => {
      await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${clientA.token}`)
        .send({
          type: TicketType.SUPPORT,
          subject: 'Trying my luck',
          description: 'This server is not mine.',
          serverId: clientB.serverId,
        })
        .expect(403);
    });

    it('rejects a missing serverId -> 400', async () => {
      await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${clientA.token}`)
        .send({
          type: TicketType.SUPPORT,
          subject: 'No server given',
          description: 'Forgot to pick a home.',
        })
        .expect(400);
    });

    it('rejects a spoofed clientId in the body -> 400 (whitelist), never overrides the authenticated client', async () => {
      const before = await ticketsRepo.count({
        where: { client: { id: clientB.clientId } },
      });

      await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${clientA.token}`)
        .send({
          type: TicketType.SUPPORT,
          subject: 'Spoof attempt',
          description: 'Trying to attribute this ticket to another client.',
          serverId: clientA.serverId,
          clientId: clientB.clientId, // not a field on CreateClientTicketDto
        })
        .expect(400);

      // Nothing was attributed to B — the request was rejected outright,
      // not silently accepted with the spoofed id stripped.
      const after = await ticketsRepo.count({
        where: { client: { id: clientB.clientId } },
      });
      expect(after).toBe(before);
    });
  });

  describe('GET /tickets/mine', () => {
    it("returns only the caller's own tickets", async () => {
      // B creates one of their own, so both clients have >=1 ticket to tell apart.
      const bTicket = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${clientB.token}`)
        .send({
          type: TicketType.OTHER,
          subject: "B's own issue",
          description: 'Unrelated to A.',
          serverId: clientB.serverId,
        })
        .expect(201);
      const bTicketBody = bTicket.body as IdBody;
      createdTicketIds.push(bTicketBody.id);

      const resA = await request(app.getHttpServer())
        .get('/tickets/mine')
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(200);

      const listA = resA.body as TicketListItem[];
      expect(Array.isArray(listA)).toBe(true);
      expect(listA.length).toBeGreaterThan(0);
      expect(listA.every((t) => t.id !== bTicketBody.id)).toBe(true);
    });
  });

  describe('GET /tickets/mine/:id', () => {
    it("returns the caller's own ticket -> 200", async () => {
      const ownTicketId = createdTicketIds[0];
      const res = await request(app.getHttpServer())
        .get(`/tickets/mine/${ownTicketId}`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(200);

      const body = res.body as { id: string; messages: unknown[] };
      expect(body.id).toBe(ownTicketId);
      expect(Array.isArray(body.messages)).toBe(true);
    });

    it("returns 404 (not 403) for another client's ticket", async () => {
      const bTicketId = createdTicketIds[createdTicketIds.length - 1]; // B's ticket from the previous block
      await request(app.getHttpServer())
        .get(`/tickets/mine/${bTicketId}`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(404);
    });
  });

  describe('POST /tickets/:id/messages', () => {
    it("posts a reply on the caller's own ticket -> 201, stored with internal: false", async () => {
      const ownTicketId = createdTicketIds[0];
      const res = await request(app.getHttpServer())
        .post(`/tickets/${ownTicketId}/messages`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .send({ message: 'It started after a power outage.' })
        .expect(201);

      const body = res.body as IdBody;
      expect(body.id).toBeDefined();
      const row = await messagesRepo.findOne({ where: { id: body.id } });
      expect(row?.internal).toBe(false);
      assertNoForbiddenKeys(body, CLIENT_FORBIDDEN_KEYS);
    });

    it("rejects a reply on another client's ticket -> 404", async () => {
      const bTicketId = createdTicketIds[createdTicketIds.length - 1];
      await request(app.getHttpServer())
        .post(`/tickets/${bTicketId}/messages`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .send({ message: 'Trying to write into a ticket that is not mine.' })
        .expect(404);
    });

    it('rejects internal: true from the client DTO -> 400, no row is written', async () => {
      const ownTicketId = createdTicketIds[0];
      const before = await messagesRepo.count({
        where: { ticket: { id: ownTicketId } },
      });

      await request(app.getHttpServer())
        .post(`/tickets/${ownTicketId}/messages`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .send({ message: 'Pretending to be staff.', internal: true })
        .expect(400);

      const after = await messagesRepo.count({
        where: { ticket: { id: ownTicketId } },
      });
      expect(after).toBe(before);
    });
  });

  describe('POST /tickets/:id/messages (staff)', () => {
    it('SUPPORT posts a public reply -> 201, stored with internal: false', async () => {
      const ownTicketId = createdTicketIds[0];
      const res = await request(app.getHttpServer())
        .post(`/tickets/${ownTicketId}/messages`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .send({ message: 'We are checking your connection.', internal: false })
        .expect(201);

      const body = res.body as IdBody & {
        author: { firstName: string; lastName: string } | null;
      };
      const row = await messagesRepo.findOne({ where: { id: body.id } });
      expect(row?.internal).toBe(false);
      expect(row?.authorRole).toBe(UserRole.SUPPORT);
      // P1.4-D2: the create response now carries a real author ref (not the
      // previous `{id}` stub) — same shape GET /tickets/:id/messages returns.
      expect(body.author?.firstName).toBe('Staff');
      assertNoForbiddenKeys(body, STAFF_FORBIDDEN_KEYS);
    });

    it('SUPPORT posts an internal note -> 201, stored with internal: true', async () => {
      const ownTicketId = createdTicketIds[0];
      const res = await request(app.getHttpServer())
        .post(`/tickets/${ownTicketId}/messages`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .send({
          message: 'Checked HA logs — zigbee integration offline.',
          internal: true,
        })
        .expect(201);

      const body = res.body as IdBody;
      const row = await messagesRepo.findOne({ where: { id: body.id } });
      expect(row?.internal).toBe(true);
      expect(row?.authorRole).toBe(UserRole.SUPPORT);
      assertNoForbiddenKeys(body, STAFF_FORBIDDEN_KEYS);
    });

    it('rejects a spoofed authorId in the staff body -> 400', async () => {
      const ownTicketId = createdTicketIds[0];
      await request(app.getHttpServer())
        .post(`/tickets/${ownTicketId}/messages`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .send({
          message: 'Spoof attempt',
          internal: false,
          authorId: clientA.userId, // not a field on CreateStaffTicketMessageDto
        })
        .expect(400);
    });

    it('rejects a nonexistent ticket -> 404', async () => {
      await request(app.getHttpServer())
        .post(`/tickets/${randomUUID()}/messages`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .send({ message: 'Hello', internal: false })
        .expect(404);
    });
  });

  describe('GET /tickets/:id/messages (staff)', () => {
    it('returns the full conversation, internal notes included', async () => {
      const ownTicketId = createdTicketIds[0];
      const res = await request(app.getHttpServer())
        .get(`/tickets/${ownTicketId}/messages`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .expect(200);

      const list = res.body as {
        internal: boolean;
        author: { firstName: string; lastName: string } | null;
      }[];
      expect(Array.isArray(list)).toBe(true);
      expect(list.some((m) => m.internal === true)).toBe(true);
      expect(list.some((m) => m.internal === false)).toBe(true);
      expect(list.some((m) => m.author?.firstName === 'Staff')).toBe(true);
      assertNoForbiddenKeys(list, STAFF_FORBIDDEN_KEYS);
    });

    it('rejects CLIENT -> 403', async () => {
      const ownTicketId = createdTicketIds[0];
      await request(app.getHttpServer())
        .get(`/tickets/${ownTicketId}/messages`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(403);
    });

    it('rejects a nonexistent ticket -> 404', async () => {
      await request(app.getHttpServer())
        .get(`/tickets/${randomUUID()}/messages`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .expect(404);
    });
  });

  describe("GET /tickets/mine/:id reflects staff's public reply, never the internal note", () => {
    it('the client-visible conversation contains the reply but not the note', async () => {
      const ownTicketId = createdTicketIds[0];
      const res = await request(app.getHttpServer())
        .get(`/tickets/mine/${ownTicketId}`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(200);

      const body = res.body as { messages: { message: string }[] };
      const texts = body.messages.map((m) => m.message);
      expect(texts).toContain('We are checking your connection.');
      expect(texts).not.toContain(
        'Checked HA logs — zigbee integration offline.',
      );
    });
  });

  describe('GET /tickets/mine and /tickets/mine/:id never leak staff-only or infra-secret fields', () => {
    it('internalNotes and Server infra secrets are absent from the response, even when set', async () => {
      const ownTicketId = createdTicketIds[0];

      // Give both leak sources a real, non-empty value — an assertion of
      // "field is undefined" only proves something if the field was ever
      // populated in the first place.
      await ticketsRepo.update(ownTicketId, {
        internalNotes: 'Client has been difficult on prior calls.',
      });
      await serversRepo.update(clientA.serverId, {
        tunnelToken: 'secret-cf-tunnel-token',
        cfAccessAppId: 'secret-cf-access-app-id',
        cfDnsRecordId: 'secret-cf-dns-record-id',
        localUrl: 'http://192.168.1.50:8123',
      });

      const detailRes = await request(app.getHttpServer())
        .get(`/tickets/mine/${ownTicketId}`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(200);
      const detailBody = detailRes.body as Record<string, unknown> & {
        server: Record<string, unknown> | null;
      };
      expect(detailBody.internalNotes).toBeUndefined();
      expect(detailBody.server?.tunnelToken).toBeUndefined();
      expect(detailBody.server?.cfAccessAppId).toBeUndefined();
      expect(detailBody.server?.cfDnsRecordId).toBeUndefined();
      expect(detailBody.server?.localUrl).toBeUndefined();
      assertNoForbiddenKeys(detailBody, CLIENT_FORBIDDEN_KEYS);

      const listRes = await request(app.getHttpServer())
        .get('/tickets/mine')
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(200);
      const listBody = listRes.body as (Record<string, unknown> & {
        server: Record<string, unknown> | null;
      })[];
      const listed = listBody.find((t) => t.id === ownTicketId);
      expect(listed?.internalNotes).toBeUndefined();
      expect(listed?.server?.tunnelToken).toBeUndefined();
      expect(listed?.server?.cfAccessAppId).toBeUndefined();
      expect(listed?.server?.cfDnsRecordId).toBeUndefined();
      expect(listed?.server?.localUrl).toBeUndefined();
      assertNoForbiddenKeys(listBody, CLIENT_FORBIDDEN_KEYS);
    });

    it('GET /servers/my also never leaks infra secrets (same Server entity, separate route)', async () => {
      const res = await request(app.getHttpServer())
        .get('/servers/my')
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(200);
      const body = res.body as Record<string, unknown>[];
      const mine = body.find((s) => s.id === clientA.serverId);
      expect(mine?.tunnelToken).toBeUndefined();
      expect(mine?.cfAccessAppId).toBeUndefined();
      expect(mine?.cfDnsRecordId).toBeUndefined();
      expect(mine?.localUrl).toBeUndefined();
      expect(mine?.tunnelId).toBeUndefined();
      assertNoForbiddenKeys(body, CLIENT_FORBIDDEN_KEYS);
    });

    it('POST /access/grant/:serverId never returns the generated supportPassword', async () => {
      const res = await request(app.getHttpServer())
        .post(`/access/grant/${clientA.serverId}`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .send({})
        .expect(201);
      const body = res.body as Record<string, unknown>;
      expect(body.id).toBeDefined();
      expect(body.supportPassword).toBeUndefined();
      assertNoForbiddenKeys(body, CLIENT_FORBIDDEN_KEYS);

      const row = await accessLogsRepo.findOne({
        where: { id: body.id as string },
      });
      // The password really was generated and stored server-side — this
      // proves the field was populated and specifically stripped from the
      // response, not just absent because nothing generated it.
      expect(row?.supportPassword).toBeTruthy();
      createdAccessLogIds.push(row!.id);
    });

    it('GET /tickets and GET /tickets/:id strip Server infra secrets for SUPPORT/SALES and ADMIN alike (P1.4-D)', async () => {
      // clientA.serverId already carries the secrets set earlier in this
      // block (tunnelToken/cfAccessAppId/cfDnsRecordId/localUrl) — reused
      // here rather than set again.
      const ownTicketId = createdTicketIds[0];

      const supportList = await request(app.getHttpServer())
        .get('/tickets')
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .expect(200);
      const supportListBody = supportList.body as (Record<string, unknown> & {
        server: Record<string, unknown> | null;
      })[];
      const supportListed = supportListBody.find((t) => t.id === ownTicketId);
      expect(supportListed?.server?.tunnelToken).toBeUndefined();
      expect(supportListed?.server?.cfAccessAppId).toBeUndefined();
      expect(supportListed?.server?.localUrl).toBeUndefined();
      assertNoForbiddenKeys(supportListBody, STAFF_FORBIDDEN_KEYS);

      const supportDetail = await request(app.getHttpServer())
        .get(`/tickets/${ownTicketId}`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .expect(200);
      const supportDetailBody = supportDetail.body as Record<
        string,
        unknown
      > & {
        server: Record<string, unknown> | null;
      };
      expect(supportDetailBody.server?.tunnelToken).toBeUndefined();
      expect(supportDetailBody.server?.cfAccessAppId).toBeUndefined();
      expect(supportDetailBody.server?.localUrl).toBeUndefined();
      assertNoForbiddenKeys(supportDetailBody, STAFF_FORBIDDEN_KEYS);

      // SALES — the title of this test has claimed "SUPPORT/SALES" all
      // along; this closes the gap where only SUPPORT was actually asserted.
      const salesDetail = await request(app.getHttpServer())
        .get(`/tickets/${ownTicketId}`)
        .set('Authorization', `Bearer ${staffSales.token}`)
        .expect(200);
      const salesDetailBody = salesDetail.body as Record<string, unknown> & {
        server: Record<string, unknown> | null;
      };
      expect(salesDetailBody.server?.tunnelToken).toBeUndefined();
      expect(salesDetailBody.server?.cfAccessAppId).toBeUndefined();
      expect(salesDetailBody.server?.localUrl).toBeUndefined();
      assertNoForbiddenKeys(salesDetailBody, STAFF_FORBIDDEN_KEYS);

      // P1.4-D: ADMIN's ticket views moved from the raw entity to
      // AdminTicketReadViewDto, same principle as P1.4-B's AdminServerRead —
      // grepping the one real ADMIN-reachable consumer (admin/tickets/page.tsx)
      // found it never reads infra secrets off a ticket's server either.
      const adminDetail = await request(app.getHttpServer())
        .get(`/tickets/${ownTicketId}`)
        .set('Authorization', `Bearer ${staffAdmin.token}`)
        .expect(200);
      const adminDetailBody = adminDetail.body as Record<string, unknown> & {
        server: Record<string, unknown> | null;
      };
      expect(adminDetailBody.server?.tunnelToken).toBeUndefined();
      expect(adminDetailBody.server?.cfAccessAppId).toBeUndefined();
      expect(adminDetailBody.server?.localUrl).toBeUndefined();
      assertNoForbiddenKeys(adminDetailBody, STAFF_FORBIDDEN_KEYS);
    });
    it('GET /servers and GET /servers/:id strip infra secrets even for ADMIN', async () => {
      // clientA.serverId already carries the secrets set earlier in this
      // block (tunnelToken/cfAccessAppId/cfDnsRecordId/localUrl).
      const listRes = await request(app.getHttpServer())
        .get('/servers')
        .set('Authorization', `Bearer ${staffAdmin.token}`)
        .expect(200);
      const listBody = listRes.body as Record<string, unknown>[];
      const listed = listBody.find((s) => s.id === clientA.serverId);
      expect(listed).toBeDefined();
      expect(listed?.tunnelToken).toBeUndefined();
      assertNoForbiddenKeys(listBody, STAFF_FORBIDDEN_KEYS);

      const detailRes = await request(app.getHttpServer())
        .get(`/servers/${clientA.serverId}`)
        .set('Authorization', `Bearer ${staffAdmin.token}`)
        .expect(200);
      expect(
        (detailRes.body as Record<string, unknown>).tunnelToken,
      ).toBeUndefined();
      assertNoForbiddenKeys(detailRes.body, STAFF_FORBIDDEN_KEYS);
    });

    it("GET /access/my-logs?ticketId= scopes to one ticket and never leaks another client's ticket history", async () => {
      const ownTicketId = createdTicketIds[0];
      const bTicketId = createdTicketIds[createdTicketIds.length - 1];

      const grantRes = await request(app.getHttpServer())
        .post(`/access/grant/${clientA.serverId}`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .send({ ticketId: ownTicketId })
        .expect(201);
      const grantBody = grantRes.body as IdBody;
      createdAccessLogIds.push(grantBody.id);

      // A, scoped to their own ticket -> sees the grant just made.
      const ownScoped = await request(app.getHttpServer())
        .get(`/access/my-logs?ticketId=${ownTicketId}`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(200);
      const ownScopedBody = ownScoped.body as { id: string }[];
      expect(ownScopedBody.some((l) => l.id === grantBody.id)).toBe(true);
      assertNoForbiddenKeys(ownScopedBody, CLIENT_FORBIDDEN_KEYS);

      // A, scoped to B's ticket -> empty, not an error, not B's data.
      const foreignScoped = await request(app.getHttpServer())
        .get(`/access/my-logs?ticketId=${bTicketId}`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(200);
      expect((foreignScoped.body as unknown[]).length).toBe(0);

      // A malformed ticketId is a validation error, not a raw DB error.
      await request(app.getHttpServer())
        .get('/access/my-logs?ticketId=not-a-uuid')
        .set('Authorization', `Bearer ${clientA.token}`)
        .expect(400);
    });
  });

  describe('PATCH /tickets/:id/status', () => {
    it('ADMIN can update status, unaffected by the messages changes', async () => {
      const ownTicketId = createdTicketIds[0];
      await request(app.getHttpServer())
        .patch(`/tickets/${ownTicketId}/status`)
        .set('Authorization', `Bearer ${staffAdmin.token}`)
        .send({ status: TicketStatus.IN_PROGRESS })
        .expect(200);

      const row = await ticketsRepo.findOne({ where: { id: ownTicketId } });
      expect(row?.status).toBe(TicketStatus.IN_PROGRESS);
    });

    it('SUPPORT can now update status along an allowed transition -> 200 (Phase 0.1)', async () => {
      const ownTicketId = createdTicketIds[0]; // currently in_progress, from the test above
      const res = await request(app.getHttpServer())
        .patch(`/tickets/${ownTicketId}/status`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .send({ status: TicketStatus.RESOLVED })
        .expect(200);

      const body = res.body as Record<string, unknown> & {
        server: Record<string, unknown> | null;
      };
      expect(body.status).toBe(TicketStatus.RESOLVED);
      // Response stripping now applies to this route for non-ADMIN, same as
      // findAll()/findOne() — the ticket's server carries infra secrets set
      // earlier in this suite.
      expect(body.server?.tunnelToken).toBeUndefined();

      const row = await ticketsRepo.findOne({ where: { id: ownTicketId } });
      expect(row?.status).toBe(TicketStatus.RESOLVED);
    });

    it('rejects a disallowed transition -> 400, status unchanged, no message written', async () => {
      const ownTicketId = createdTicketIds[0]; // currently resolved, from the test above
      const before = await messagesRepo.count({
        where: { ticket: { id: ownTicketId } },
      });

      await request(app.getHttpServer())
        .patch(`/tickets/${ownTicketId}/status`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .send({ status: TicketStatus.NEW })
        .expect(400);

      const row = await ticketsRepo.findOne({ where: { id: ownTicketId } });
      expect(row?.status).toBe(TicketStatus.RESOLVED);

      const after = await messagesRepo.count({
        where: { ticket: { id: ownTicketId } },
      });
      expect(after).toBe(before);
    });

    it('a real transition writes an internal TicketMessage recording the change', async () => {
      const ownTicketId = createdTicketIds[0]; // currently resolved
      await request(app.getHttpServer())
        .patch(`/tickets/${ownTicketId}/status`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .send({ status: TicketStatus.CLOSED })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/tickets/${ownTicketId}/messages`)
        .set('Authorization', `Bearer ${staffAdmin.token}`)
        .expect(200);

      const messages = res.body as {
        message: string;
        internal: boolean;
        authorRole: string;
      }[];
      const note = messages.find((m) =>
        m.message.includes('resolved → closed'),
      );
      expect(note).toBeDefined();
      expect(note?.internal).toBe(true);
      expect(note?.authorRole).toBe(UserRole.SUPPORT);
    });

    it('a same-status request is a no-op -> 200, no message written', async () => {
      const ownTicketId = createdTicketIds[0]; // currently closed
      const before = await messagesRepo.count({
        where: { ticket: { id: ownTicketId } },
      });

      await request(app.getHttpServer())
        .patch(`/tickets/${ownTicketId}/status`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .send({ status: TicketStatus.CLOSED })
        .expect(200);

      const after = await messagesRepo.count({
        where: { ticket: { id: ownTicketId } },
      });
      expect(after).toBe(before);
    });

    it('CLIENT is still rejected -> 403 (unchanged)', async () => {
      const ownTicketId = createdTicketIds[0];
      await request(app.getHttpServer())
        .patch(`/tickets/${ownTicketId}/status`)
        .set('Authorization', `Bearer ${clientA.token}`)
        .send({ status: TicketStatus.NEW })
        .expect(403);
    });

    it('SALES can update status along an allowed transition -> 200, response stripped (pre-existing SALES access, unbroken by the Phase 0.1 refactor)', async () => {
      const salesTicket = await request(app.getHttpServer())
        .post('/tickets')
        .set('Authorization', `Bearer ${clientA.token}`)
        .send({
          type: TicketType.SUPPORT,
          subject: 'SALES status transition coverage',
          description: 'Dedicated ticket for the SALES role smoke matrix.',
          serverId: clientA.serverId,
        })
        .expect(201);
      const salesTicketId = (salesTicket.body as IdBody).id;
      createdTicketIds.push(salesTicketId);

      const res = await request(app.getHttpServer())
        .patch(`/tickets/${salesTicketId}/status`)
        .set('Authorization', `Bearer ${staffSales.token}`)
        .send({ status: TicketStatus.IN_PROGRESS })
        .expect(200);

      const body = res.body as Record<string, unknown> & {
        server: Record<string, unknown> | null;
      };
      expect(body.status).toBe(TicketStatus.IN_PROGRESS);
      // clientA.serverId carries the infra secrets set earlier in this
      // suite — SALES must not receive them here either.
      expect(body.server?.tunnelToken).toBeUndefined();
      expect(body.server?.cfAccessAppId).toBeUndefined();

      // Disallowed transition from here (IN_PROGRESS -> NEW) -> 400.
      await request(app.getHttpServer())
        .patch(`/tickets/${salesTicketId}/status`)
        .set('Authorization', `Bearer ${staffSales.token}`)
        .send({ status: TicketStatus.NEW })
        .expect(400);

      const row = await ticketsRepo.findOne({ where: { id: salesTicketId } });
      expect(row?.status).toBe(TicketStatus.IN_PROGRESS);
    });
  });

  describe('GET /tickets?clientId= (Phase 0.2)', () => {
    it('returns only tickets belonging to the given client', async () => {
      const resA = await request(app.getHttpServer())
        .get(`/tickets?clientId=${clientA.clientId}`)
        .set('Authorization', `Bearer ${staffAdmin.token}`)
        .expect(200);
      const listA = resA.body as { id: string; client?: { id: string } }[];
      expect(listA.length).toBeGreaterThan(0);
      expect(listA.every((t) => t.client?.id === clientA.clientId)).toBe(
        true,
      );

      const resB = await request(app.getHttpServer())
        .get(`/tickets?clientId=${clientB.clientId}`)
        .set('Authorization', `Bearer ${staffAdmin.token}`)
        .expect(200);
      const listB = resB.body as { id: string }[];
      expect(listB.some((t) => t.id === createdTicketIds[0])).toBe(false);
    });

    it('GET /tickets (no clientId) is unaffected — still returns tickets from both clients', async () => {
      const res = await request(app.getHttpServer())
        .get('/tickets')
        .set('Authorization', `Bearer ${staffAdmin.token}`)
        .expect(200);
      const list = res.body as { client?: { id: string } | null }[];
      const clientIds = new Set(
        list.map((t) => t.client?.id).filter(Boolean),
      );
      expect(clientIds.has(clientA.clientId)).toBe(true);
    });

    it('SUPPORT can also use clientId filtering (role unchanged, filter is additive)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tickets?clientId=${clientA.clientId}`)
        .set('Authorization', `Bearer ${staffSupport.token}`)
        .expect(200);
      const list = res.body as { client?: { id: string } }[];
      expect(list.every((t) => t.client?.id === clientA.clientId)).toBe(
        true,
      );
    });

    it('SALES can also use clientId filtering (role unchanged, filter is additive)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tickets?clientId=${clientA.clientId}`)
        .set('Authorization', `Bearer ${staffSales.token}`)
        .expect(200);
      const list = res.body as { client?: { id: string } }[];
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((t) => t.client?.id === clientA.clientId)).toBe(
        true,
      );
    });
  });

  describe('POST /tickets/public', () => {
    it('stays reachable without a JWT and creates a ticket with clientId/serverId = null', async () => {
      const res = await request(app.getHttpServer())
        .post('/tickets/public')
        .send({
          name: 'Anonymous Lead',
          email: `anon-${randomUUID()}@example.test`,
          subject: 'Interested in Tinta Lab',
          message: 'Please contact me about pricing.',
        })
        .expect(201);

      const body = res.body as IdBody;
      expect(body.id).toBeDefined();
      createdTicketIds.push(body.id);

      const row = await ticketsRepo.findOne({
        where: { id: body.id },
        relations: ['client', 'server'],
      });
      expect(row?.client).toBeNull();
      expect(row?.server).toBeNull();
    });
  });
});
