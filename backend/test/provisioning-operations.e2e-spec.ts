import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { User, UserRole } from '../src/users/entities/user.entity';
import { Client } from '../src/clients/entities/client.entity';
import { ProvisioningOperationsService } from '../src/provisioning/provisioning-operations.service';
import {
  ProvisioningLastCompletedStep,
  ProvisioningOperation,
} from '../src/provisioning/entities/provisioning-operation.entity';

// PHASE1_4_PROVISIONING_SPEC.md §5.4/§5.6/§6.1/§6.4 — direct service-level
// coverage of the atomic idempotency claim, since its whole point is real
// Postgres ON CONFLICT/atomicity semantics that a mocked repository cannot
// exercise (confirmed manually during the Step 1 migration verification:
// the DO UPDATE ... WHERE guard returns zero rows via RETURNING when it
// doesn't match, not the unchanged row — this suite locks that behavior in
// as a regression test rather than leaving it as tribal knowledge).
//
// No HTTP layer involved — ProvisioningOperationsService is not yet wired
// into ProvisioningController/ProvisioningService.provisionClient()
// (§ Sequencing step 3). This is infrastructure-only coverage.
//
// Runs against tinta_lab_test, never tinta_lab.
jest.setTimeout(30_000);

describe('ProvisioningOperationsService (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepo: Repository<User>;
  let clientsRepo: Repository<Client>;
  let operationsRepo: Repository<ProvisioningOperation>;
  let service: ProvisioningOperationsService;

  let principalUserId: string;
  const createdUserIds: string[] = [];
  const createdClientIds: string[] = [];
  const createdOperationIds: string[] = [];

  function uniqueToken(): string {
    return randomUUID().slice(0, 8);
  }

  function track(op: ProvisioningOperation): ProvisioningOperation {
    createdOperationIds.push(op.id);
    return op;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    usersRepo = moduleFixture.get(getRepositoryToken(User));
    clientsRepo = moduleFixture.get(getRepositoryToken(Client));
    operationsRepo = moduleFixture.get(getRepositoryToken(ProvisioningOperation));
    service = moduleFixture.get(ProvisioningOperationsService);

    const hashed = await bcrypt.hash('Test1234!', 12);
    const user = await usersRepo.save(
      usersRepo.create({
        email: `provops-${uniqueToken()}@example.test`,
        password: hashed,
        firstName: 'ProvOps',
        lastName: 'Fixture',
        role: UserRole.ADMIN,
      }),
    );
    principalUserId = user.id;
    createdUserIds.push(user.id);
  });

  afterAll(async () => {
    if (createdOperationIds.length) await operationsRepo.delete(createdOperationIds);
    if (createdClientIds.length) await clientsRepo.delete(createdClientIds);
    if (createdUserIds.length) await usersRepo.delete(createdUserIds);
    await app.close();
  });

  it('claim() with no Idempotency-Key always creates a fresh operation, even for identical repeats', async () => {
    const first = await service.claim({
      principalUserId,
      idempotencyKey: null,
      requestFingerprint: 'fp-no-key',
    });
    track(first.operation);
    const second = await service.claim({
      principalUserId,
      idempotencyKey: null,
      requestFingerprint: 'fp-no-key',
    });
    track(second.operation);

    expect(first.outcome).toBe('created');
    expect(second.outcome).toBe('created');
    expect(first.operation.id).not.toBe(second.operation.id);
  });

  it('claim() with a new key creates exactly one operation, IN_PROGRESS', async () => {
    const key = `key-created-${uniqueToken()}`;
    const result = await service.claim({
      principalUserId,
      idempotencyKey: key,
      requestFingerprint: 'fp-a',
    });
    track(result.operation);

    expect(result.outcome).toBe('created');
    expect(result.operation.status).toBe('in_progress');
    expect(result.operation.idempotencyKey).toBe(key);
  });

  it('claim() with the same key+fingerprint while still IN_PROGRESS returns in_progress, same row, no mutation', async () => {
    const key = `key-inprogress-${uniqueToken()}`;
    const created = await service.claim({
      principalUserId,
      idempotencyKey: key,
      requestFingerprint: 'fp-b',
    });
    track(created.operation);

    const repeat = await service.claim({
      principalUserId,
      idempotencyKey: key,
      requestFingerprint: 'fp-b',
    });

    expect(repeat.outcome).toBe('in_progress');
    expect(repeat.operation.id).toBe(created.operation.id);
  });

  it('claim() replays SUCCEEDED with the completed cachedResult', async () => {
    const key = `key-succeeded-${uniqueToken()}`;
    const created = await service.claim({
      principalUserId,
      idempotencyKey: key,
      requestFingerprint: 'fp-c',
    });
    track(created.operation);

    await service.complete(created.operation.id, { installUrl: 'https://example.test/install/xyz' });

    const replay = await service.claim({
      principalUserId,
      idempotencyKey: key,
      requestFingerprint: 'fp-c',
    });

    expect(replay.outcome).toBe('succeeded');
    expect(replay.operation.id).toBe(created.operation.id);
    expect(replay.operation.cachedResult).toEqual({
      installUrl: 'https://example.test/install/xyz',
    });
    expect(replay.operation.status).toBe('succeeded');
  });

  it('FAILED + same key + same fingerprint reopens the SAME operation (§6.4), clearing failure detail', async () => {
    const key = `key-reopen-${uniqueToken()}`;
    const created = await service.claim({
      principalUserId,
      idempotencyKey: key,
      requestFingerprint: 'fp-d',
    });
    track(created.operation);
    await service.advanceStep(created.operation.id, ProvisioningLastCompletedStep.ENSURE_SERVER);
    await service.fail(created.operation.id, 'SUBDOMAIN_TAKEN', 'simulated race');

    const reopened = await service.claim({
      principalUserId,
      idempotencyKey: key,
      requestFingerprint: 'fp-d',
    });

    expect(reopened.outcome).toBe('reopened');
    expect(reopened.operation.id).toBe(created.operation.id);
    expect(reopened.operation.status).toBe('in_progress');
    expect(reopened.operation.failureCode).toBeNull();
    expect(reopened.operation.failureMessage).toBeNull();
    expect(reopened.operation.completedAt).toBeNull();
    // lastCompletedStep survives the reopen — this is exactly what lets a
    // retry resume instead of starting over (§6.2/§6.3).
    expect(reopened.operation.lastCompletedStep).toBe('ensure_server');
  });

  it('FAILED + same key + DIFFERENT fingerprint is a true no-op: 409-worthy mismatch, zero mutation (§5.2/§6.4 v2.4 fix)', async () => {
    const key = `key-mismatch-${uniqueToken()}`;
    const created = await service.claim({
      principalUserId,
      idempotencyKey: key,
      requestFingerprint: 'fp-original',
    });
    track(created.operation);
    await service.fail(created.operation.id, 'SUBDOMAIN_TAKEN');

    const mismatched = await service.claim({
      principalUserId,
      idempotencyKey: key,
      requestFingerprint: 'fp-DIFFERENT',
    });

    expect(mismatched.outcome).toBe('fingerprint_mismatch');
    expect(mismatched.operation.id).toBe(created.operation.id);

    // Assert directly against the database row, not just the returned
    // value, that the atomic claim genuinely never mutated it.
    const persisted = await operationsRepo.findOneOrFail({ where: { id: created.operation.id } });
    expect(persisted.status).toBe('failed');
    expect(persisted.requestFingerprint).toBe('fp-original');
    expect(persisted.failureCode).toBe('SUBDOMAIN_TAKEN');
  });

  it('two concurrent claims with the same brand-new key race safely: exactly one row, one created + one in_progress', async () => {
    const key = `key-race-${uniqueToken()}`;
    const [a, b] = await Promise.all([
      service.claim({ principalUserId, idempotencyKey: key, requestFingerprint: 'fp-race' }),
      service.claim({ principalUserId, idempotencyKey: key, requestFingerprint: 'fp-race' }),
    ]);
    track(a.operation);

    const outcomes = [a.outcome, b.outcome].sort();
    expect(outcomes).toEqual(['created', 'in_progress']);
    expect(a.operation.id).toBe(b.operation.id);

    const rows = await operationsRepo.find({
      where: { principalUserId, idempotencyKey: key },
    });
    expect(rows).toHaveLength(1);
  });

  it('advanceStep() records clientId/serverId alongside the step, once known', async () => {
    const created = await service.claim({
      principalUserId,
      idempotencyKey: `key-advance-${uniqueToken()}`,
      requestFingerprint: 'fp-e',
    });
    track(created.operation);

    await service.advanceStep(created.operation.id, ProvisioningLastCompletedStep.RESOLVE_CLIENT);
    const afterResolve = await operationsRepo.findOneOrFail({ where: { id: created.operation.id } });
    expect(afterResolve.lastCompletedStep).toBe('resolve_client');
    expect(afterResolve.clientId).toBeNull();

    const hashed = await bcrypt.hash('Test1234!', 12);
    const clientUser = await usersRepo.save(
      usersRepo.create({
        email: `provops-client-${uniqueToken()}@example.test`,
        password: hashed,
        firstName: 'ProvOps',
        lastName: 'ClientFixture',
        role: UserRole.CLIENT,
      }),
    );
    createdUserIds.push(clientUser.id);
    const client = await clientsRepo.save(
      clientsRepo.create({ user: clientUser, phone: '+49 151 0000001' }),
    );
    createdClientIds.push(client.id);

    await service.advanceStep(created.operation.id, ProvisioningLastCompletedStep.ENSURE_SERVER, {
      clientId: client.id,
    });
    const afterServer = await operationsRepo.findOneOrFail({ where: { id: created.operation.id } });
    expect(afterServer.lastCompletedStep).toBe('ensure_server');
    expect(afterServer.clientId).toBe(client.id);
  });
});
