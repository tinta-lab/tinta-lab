import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Generated,
  Index,
} from 'typeorm';

export enum AuditEventType {
  GRANTED = 'granted',
  CONNECTED = 'connected',
  ACTIVITY_LOG = 'activity_log',
  SECURITY_ANOMALY = 'security_anomaly',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

// Append-only hash-chained audit ledger. Rows are never updated or deleted —
// enforced both in application code (AuditLogService only ever inserts) and at
// the DB level (see sql/001_access_hardening.sql, which blocks UPDATE/DELETE
// with a trigger). This is a separate table from `access_logs` on purpose:
// access_logs is a mutable "current state" projection used by the UI, while
// this table is the tamper-evident record of what actually happened.
@Entity('audit_events')
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Monotonic insertion order — used to walk the chain deterministically,
  // since two events can share the same millisecond timestamp.
  @Index()
  @Column({ type: 'bigint' })
  @Generated('increment')
  seq: string;

  @Index()
  @Column({ type: 'uuid' })
  accessLogId: string;

  @Column({ type: 'enum', enum: AuditEventType })
  eventType: AuditEventType;

  // Never store secrets here (passwords, tokens, WiFi keys, raw payloads).
  @Column({ nullable: true, type: 'uuid' })
  actorUserId: string | null;

  @Column({ nullable: true, type: 'jsonb' })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true, type: 'varchar', length: 64 })
  prevHash: string | null;

  @Column({ type: 'varchar', length: 64 })
  hash: string;
}
