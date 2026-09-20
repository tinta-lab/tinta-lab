import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ProvisioningLastCompletedStep,
  ProvisioningOperation,
  ProvisioningOperationStatus,
} from './entities/provisioning-operation.entity';

// PHASE1_4_PROVISIONING_SPEC.md §5.4/§5.6/§6.1/§6.4 — infrastructure only.
// Nothing here reads or writes AgentSession.provisioningState; this service
// knows nothing about the client lifecycle, only about one execution
// attempt's own claim/progress/completion. Not yet wired into
// ProvisioningService/ProvisioningController (§ Sequencing step 3).

export type ProvisioningClaimOutcome =
  | 'created'
  | 'reopened'
  | 'in_progress'
  | 'succeeded'
  | 'fingerprint_mismatch';

export interface ProvisioningClaimResult {
  outcome: ProvisioningClaimOutcome;
  operation: ProvisioningOperation;
}

export interface ProvisioningClaimInput {
  principalUserId: string;
  idempotencyKey: string | null;
  requestFingerprint: string;
}

@Injectable()
export class ProvisioningOperationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(ProvisioningOperation)
    private readonly operationsRepo: Repository<ProvisioningOperation>,
  ) {}

  // §5.4's atomic claim. A single statement handles both the keyed and
  // unkeyed cases: the partial unique index only ever indexes rows where
  // idempotencyKey IS NOT NULL, so a NULL-key insert can never conflict
  // against it (verified directly against Postgres — two NULL-key inserts
  // for the same principal both land as fresh, distinct rows) and always
  // takes the 'created' branch below.
  //
  // §5.6's exact three-way split on conflict-with-matching-status, plus the
  // fingerprint-mismatch case §5.2 requires and the reviewer's mandated
  // fallback SELECT when `RETURNING` comes back empty (confirmed by direct
  // testing in Step 1: a `DO UPDATE ... WHERE` guard that evaluates false
  // returns zero rows from RETURNING, not the unchanged existing row).
  async claim(input: ProvisioningClaimInput): Promise<ProvisioningClaimResult> {
    const rows = await this.dataSource.query<
      Array<ProvisioningOperationRow & { wasInserted: boolean }>
    >(
      `INSERT INTO provisioning_operations
         ("principalUserId", "idempotencyKey", "requestFingerprint", status)
       VALUES ($1, $2, $3, 'in_progress')
       ON CONFLICT ("principalUserId", "idempotencyKey")
         WHERE "idempotencyKey" IS NOT NULL
       DO UPDATE SET
         status = 'in_progress',
         "failureCode" = NULL,
         "failureMessage" = NULL,
         "completedAt" = NULL
       WHERE provisioning_operations.status = 'failed'
         AND provisioning_operations."requestFingerprint" = EXCLUDED."requestFingerprint"
       RETURNING *, (xmax = 0) AS "wasInserted"`,
      [input.principalUserId, input.idempotencyKey, input.requestFingerprint],
    );

    if (rows.length > 0) {
      const { wasInserted, ...row } = rows[0];
      const operation = toEntity(row);
      return { outcome: wasInserted ? 'created' : 'reopened', operation };
    }

    // Zero rows: either the conflicting row's fingerprint didn't match (the
    // guard's fingerprint condition failed), or its status wasn't 'failed'
    // (IN_PROGRESS or SUCCEEDED). Either way, nothing was mutated — this
    // SELECT only reads, per the mandated sequence: fingerprint check first,
    // regardless of status; only a matching fingerprint distinguishes
    // IN_PROGRESS from SUCCEEDED.
    const existing = await this.operationsRepo.findOneOrFail({
      where: {
        principalUserId: input.principalUserId,
        idempotencyKey: input.idempotencyKey ?? undefined,
      },
    });

    if (existing.requestFingerprint !== input.requestFingerprint) {
      return { outcome: 'fingerprint_mismatch', operation: existing };
    }
    if (existing.status === ProvisioningOperationStatus.IN_PROGRESS) {
      return { outcome: 'in_progress', operation: existing };
    }
    if (existing.status === ProvisioningOperationStatus.SUCCEEDED) {
      return { outcome: 'succeeded', operation: existing };
    }
    // status === FAILED with a matching fingerprint is unreachable here:
    // the atomic UPDATE's WHERE clause (status='failed' AND fingerprint
    // matches) would already have matched and returned a row above. Getting
    // here means the claim's own atomicity assumption was violated —
    // surfacing that loudly is safer than silently treating it as any of
    // the three real outcomes.
    throw new Error(
      `ProvisioningOperationsService.claim: unreachable state for operation ${existing.id} ` +
        `(status=${existing.status}, fingerprint matched, but no row was returned by the atomic claim)`,
    );
  }

  // Advances the recovery cursor (§6.1) and, when known for the first time,
  // records which Client/Server this operation resolved to (§4.1's
  // deterministic operation->resource binding). Never touches
  // ProvisioningState.
  async advanceStep(
    operationId: string,
    step: ProvisioningLastCompletedStep,
    resource?: { clientId?: string; serverId?: string },
  ): Promise<void> {
    await this.operationsRepo.update(
      { id: operationId },
      {
        lastCompletedStep: step,
        ...(resource?.clientId ? { clientId: resource.clientId } : {}),
        ...(resource?.serverId ? { serverId: resource.serverId } : {}),
      },
    );
  }

  // §5.6's COMPLETE write order: cachedResult persisted, then status =
  // SUCCEEDED, then completedAt — all in the one statement below, so a
  // reader can never observe SUCCEEDED without a replayable cachedResult
  // already present.
  async complete(
    operationId: string,
    cachedResult: Record<string, unknown>,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE provisioning_operations
       SET "cachedResult" = $2,
           status = 'succeeded',
           "completedAt" = now(),
           "lastCompletedStep" = 'complete'
       WHERE id = $1`,
      [operationId, JSON.stringify(cachedResult)],
    );
  }

  // §6.4 — terminal for this execution attempt only, never touches any
  // AgentSession/ProvisioningState.
  async fail(
    operationId: string,
    failureCode: string,
    failureMessage?: string,
  ): Promise<void> {
    await this.operationsRepo.update(
      { id: operationId },
      {
        status: ProvisioningOperationStatus.FAILED,
        failureCode,
        failureMessage: failureMessage ?? null,
        completedAt: new Date(),
      },
    );
  }
}

// Shape of a raw-query row: same field names as the entity (columns are
// quoted camelCase), but plain data, not a class instance.
type ProvisioningOperationRow = Record<string, unknown>;

function toEntity(row: ProvisioningOperationRow): ProvisioningOperation {
  return row as unknown as ProvisioningOperation;
}
