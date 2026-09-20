import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

// PHASE1_4_PROVISIONING_SPEC.md §6.1 — one row per provisionClient()
// execution attempt. "operationId" in the spec is this entity's `id`,
// matching every other entity's PK convention in this codebase rather than
// a literally-named column — see sql/011_provisioning_state_machine.sql's
// header note.
export enum ProvisioningOperationStatus {
  IN_PROGRESS = 'in_progress',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

// §6.1's explicit recovery cursor — never a ProvisioningState value
// (§3.0's hard rule), only meaningful for resuming/recovering this specific
// operation.
export enum ProvisioningLastCompletedStep {
  RESOLVE_CLIENT = 'resolve_client',
  ENSURE_SERVER = 'ensure_server',
  RECONCILE_CLOUDFLARE = 'reconcile_cloudflare',
  ENSURE_AGENT_SESSION = 'ensure_agent_session',
  PREPARE_INSTALL = 'prepare_install',
  COMPLETE = 'complete',
}

// Declared here, not just in sql/011_provisioning_state_machine.sql, because
// TypeORM's `synchronize: true` (test/dev — never production, where
// synchronize is off and the SQL migration is the only source of truth)
// DROPS any index it doesn't recognize from the entity. Confirmed directly:
// running the e2e suite against a freshly-migrated tinta_lab_test silently
// stripped every hand-written index, including this one — the load-bearing
// piece of the whole §5.4 idempotency model. Declaring it here is what
// makes synchronize preserve/recreate it instead.
@Index('idx_provisioning_operations_principal_key', ['principalUserId', 'idempotencyKey'], {
  unique: true,
  where: '"idempotencyKey" IS NOT NULL',
})
@Index('idx_provisioning_operations_in_progress', ['updatedAt'], {
  where: "status = 'in_progress'",
})
@Entity('provisioning_operations')
export class ProvisioningOperation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_provisioning_operations_client')
  @Column({ nullable: true, type: 'uuid' })
  clientId: string | null;

  @Index('idx_provisioning_operations_server')
  @Column({ nullable: true, type: 'uuid' })
  serverId: string | null;

  // Caller-supplied HTTP-layer dedup key (§5.1) — null means this operation
  // was never claimable via the partial unique index and always gets a
  // fresh row on retry (§5.1/§6.4).
  @Column({ nullable: true, type: 'varchar', length: 255 })
  idempotencyKey: string | null;

  @Column({ type: 'uuid' })
  principalUserId: string;

  // §5.3's deterministic hash — never derived from password/timestamps/
  // generated IDs.
  @Column({ type: 'varchar', length: 64 })
  requestFingerprint: string;

  @Column({
    type: 'enum',
    enum: ProvisioningOperationStatus,
    default: ProvisioningOperationStatus.IN_PROGRESS,
  })
  status: ProvisioningOperationStatus;

  @Column({
    nullable: true,
    type: 'enum',
    enum: ProvisioningLastCompletedStep,
  })
  lastCompletedStep: ProvisioningLastCompletedStep | null;

  @Column({ nullable: true, type: 'timestamp' })
  completedAt: Date | null;

  // Freeform per §16, not a native enum — see the migration's rationale.
  @Column({ nullable: true, type: 'varchar', length: 64 })
  failureCode: string | null;

  @Column({ nullable: true, type: 'text' })
  failureMessage: string | null;

  // The ProvisionResultDto to replay on a SUCCEEDED same-key retry (§5.2).
  // §5.6's write-order rule: this is set before `status` flips to
  // SUCCEEDED in the same statement, never after.
  @Column({ nullable: true, type: 'jsonb' })
  cachedResult: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
