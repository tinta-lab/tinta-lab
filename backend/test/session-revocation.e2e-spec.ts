import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { User, UserRole } from '../src/users/entities/user.entity';
import { RevokedSession } from '../src/auth/entities/revoked-session.entity';
import { csrfOriginGuard } from '../src/common/csrf-origin-guard.middleware';

// End-to-end contract for session revocation (Postgres, replacing the Redis
// blacklist that failed open). Through the real cookie + sliding-session
// path, against a real database:
//   - logout revokes the whole session: the login token AND every token the
//     sliding session re-issued are refused afterwards;
//   - logout's response clears the cookie and does NOT hand out a fresh one
//     (it used to, right after clearCookie, so the browser stayed signed in);
//   - logging out one session leaves the user's other sessions alone;
//   - tokens without a session id and sessions of deactivated users are
//     refused.
//
// Runs against tinta_lab_test, never production.
jest.setTimeout(30_000);

const ORIGIN = 'https://app.e2e.test';
const PROBE = '/tinta-core/release-info'; // any 200 route under JwtAuthGuard

describe('Session revocation (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  let revokedRepo: Repository<RevokedSession>;
  let jwt: JwtService;
  const PASSWORD = 'Test1234!';
  const createdUserIds: string[] = [];

  async function createAdmin(): Promise<User> {
    const user = await usersRepo.save(
      usersRepo.create({
        email: `session-revocation-${randomUUID().slice(0, 8)}@example.test`,
        password: await bcrypt.hash(PASSWORD, 12),
        firstName: 'Session',
        lastName: 'Revocation',
        role: UserRole.ADMIN,
      }),
    );
    createdUserIds.push(user.id);
    return user;
  }

  // Returns the access_token cookie value set by a response (null if it was
  // cleared), and how many access_token cookies the response set.
  function authCookies(res: request.Response): string[] {
    const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
    return (raw ?? []).filter((c) => c.startsWith('access_token='));
  }
  function cookieValue(setCookie: string): string {
    return setCookie.split(';')[0].slice('access_token='.length);
  }

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return cookieValue(authCookies(res)[0]);
  }

  function probe(token: string) {
    return request(app.getHttpServer())
      .get(PROBE)
      .set('Cookie', `access_token=${token}`);
  }

  beforeAll(async () => {
    process.env.AGENT_LATEST_STABLE_VERSION = '2026.9.2';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Same cookie + CSRF middleware as main.ts — the path under test.
    app.use(cookieParser());
    app.use(csrfOriginGuard(ORIGIN));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    // Listen once: supertest otherwise starts a throwaway listener per
    // request, and the parallel requests in the race test then hit ECONNRESET.
    await app.listen(0);

    usersRepo = moduleFixture.get(getRepositoryToken(User));
    revokedRepo = moduleFixture.get(getRepositoryToken(RevokedSession));
    jwt = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    // revoked_sessions rows go with their users (ON DELETE CASCADE)
    if (createdUserIds.length) await usersRepo.delete(createdUserIds);
    await app.close();
  });

  it('logout revokes the whole session and does not re-issue a cookie', async () => {
    const admin = await createAdmin();
    const loginToken = await login(admin.email);
    const sid = (jwt.decode(loginToken) as { sid?: string }).sid;
    expect(sid).toMatch(/^[0-9a-f-]{36}$/);

    // The sliding session re-issues a token under the same sid (byte-equal
    // to the login token if both fall in the same second — iat is seconds).
    const slid = await probe(loginToken).expect(200);
    const renewed = cookieValue(authCookies(slid)[0]);
    expect((jwt.decode(renewed) as { sid?: string }).sid).toBe(sid);

    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', ORIGIN)
      .set('Cookie', `access_token=${renewed}`)
      .expect(204);
    // Exactly one access_token cookie on the response, and it's the clearing one.
    const set = authCookies(logout);
    expect(set).toHaveLength(1);
    expect(cookieValue(set[0])).toBe('');

    // Every token of the session is dead — not just the one used to log out.
    await probe(renewed).expect(401);
    await probe(loginToken).expect(401);
    await request(app.getHttpServer())
      .get(PROBE)
      .set('Authorization', `Bearer ${loginToken}`)
      .expect(401);

    const row = await revokedRepo.findOneByOrFail({ sessionId: sid! });
    expect(row.userId).toBe(admin.id);
    // kept until the newest possible token of the session has expired
    expect(row.expiresAt.getTime()).toBeGreaterThan(
      Date.now() + 10 * 60 * 1000,
    );
  });

  it("logging out one session leaves the user's other sessions working", async () => {
    const admin = await createAdmin();
    const a = await login(admin.email);
    const b = await login(admin.email);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', ORIGIN)
      .set('Cookie', `access_token=${a}`)
      .expect(204);

    await probe(a).expect(401);
    await probe(b).expect(200);
  });

  it('requests racing the logout cannot keep the session alive', async () => {
    const admin = await createAdmin();
    const token = await login(admin.email);

    // Some of these are validated before the revocation lands and get a
    // renewed cookie; whichever way the race goes, every token of the
    // session must be dead once the logout has been recorded.
    const [logout, ...raced] = await Promise.all([
      request(app.getHttpServer())
        .post('/auth/logout')
        .set('Origin', ORIGIN)
        .set('Cookie', `access_token=${token}`),
      ...Array.from({ length: 8 }, () => probe(token)),
    ]);
    expect(logout.status).toBe(204);

    const renewed = raced
      .flatMap((r) => authCookies(r).map(cookieValue))
      .filter(Boolean);
    await probe(token).expect(401);
    for (const t of renewed) await probe(t).expect(401);
  });

  it('refuses tokens without a session id (issued before sessions existed)', async () => {
    const admin = await createAdmin();
    const legacy = jwt.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });
    await probe(legacy).expect(401);
  });

  it('refuses a live session once the user is deactivated', async () => {
    const admin = await createAdmin();
    const token = await login(admin.email);
    await probe(token).expect(200);

    await usersRepo.update(admin.id, { isActive: false });
    await probe(token).expect(401);
  });
});
