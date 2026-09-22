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

// Production-contract coverage for GET /tinta-core/release-info, the
// dashboard's only source for the Agent update badge (2026-09-22 fix for
// the hardcoded LATEST_VERSION downgrade bug). Pins two things that must
// never regress silently:
//   1. response shape — { latestStable: string }
//   2. authorization — ADMIN only, same as every other /tinta-core/* route;
//      a CLIENT-role session (or none at all) must never see this, and the
//      dashboard's own admin session must never end up permanently unable
//      to fetch it (which would leave latestStable stuck at null forever).
//
// Runs against tinta_lab_test, never production.
jest.setTimeout(30_000);

describe('GET /tinta-core/release-info (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  const PASSWORD = 'Test1234!';
  const createdUserIds: string[] = [];

  function uniqueToken(): string {
    return randomUUID().slice(0, 8);
  }

  async function createUser(role: UserRole): Promise<User> {
    const hashed = await bcrypt.hash(PASSWORD, 12);
    const user = await usersRepo.save(
      usersRepo.create({
        email: `release-info-${role}-${uniqueToken()}@example.test`,
        password: hashed,
        firstName: 'Release',
        lastName: 'Info',
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

  beforeAll(async () => {
    // Matches backend/.env.example's AGENT_LATEST_STABLE_VERSION — set here
    // explicitly so this suite doesn't depend on whatever (if anything) is
    // configured for the test environment.
    process.env.AGENT_LATEST_STABLE_VERSION = '2026.9.2';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    usersRepo = moduleFixture.get(getRepositoryToken(User));
  });

  afterAll(async () => {
    if (createdUserIds.length) await usersRepo.delete(createdUserIds);
    await app.close();
  });

  it('ADMIN gets exactly { latestStable: string } — the contract the dashboard relies on', async () => {
    const admin = await createUser(UserRole.ADMIN);
    const token = await login(admin.email);

    const res = await request(app.getHttpServer())
      .get('/tinta-core/release-info')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({ latestStable: '2026.9.2' });
  });

  it('CLIENT role is forbidden — same authorization boundary as every other /tinta-core/* route', async () => {
    const client = await createUser(UserRole.CLIENT);
    const token = await login(client.email);

    await request(app.getHttpServer())
      .get('/tinta-core/release-info')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('unauthenticated requests are rejected', async () => {
    await request(app.getHttpServer()).get('/tinta-core/release-info').expect(401);
  });
});
