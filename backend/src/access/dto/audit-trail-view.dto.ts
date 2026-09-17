import { ApiProperty } from '@nestjs/swagger';
import { AuditEventType } from '../entities/audit-event.entity';

// Technical/cryptographic view of one audit_events row — includes the
// hash-chain fields (seq/hash/prevHash) that AccessEventViewDto/AccessLogDetail
// deliberately omit from the general-purpose views. ADMIN-only
// (GET /access/audit/:accessLogId) — the general session detail view never
// needs this level of internals. Structurally matches the AuditEvent entity
// returned by AccessService.getAuditTrail(); kept as a separate type so the
// frontend contract doesn't depend on the entity shape directly.
export class AuditTrailEventViewDto {
  id: string;
  seq: string;
  accessLogId: string;
  @ApiProperty({ enum: AuditEventType, enumName: 'AuditEventType' })
  eventType: AuditEventType;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  prevHash: string | null;
  hash: string;
}

// Mirrors AuditLogService.verifyChain()'s return shape (GET
// /access/audit-verify) — defined here rather than in audit-log.service.ts
// itself, which stays untouched (its inline `{valid, brokenAtEventId?}`
// return type already exactly matches this shape).
export class AuditChainVerificationDto {
  valid: boolean;
  brokenAtEventId?: string;
}
