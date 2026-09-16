import { AuditEventType } from '../entities/audit-event.entity';

// Technical/cryptographic view of one audit_events row — includes the
// hash-chain fields (seq/hash/prevHash) that AccessEventView/AccessLogDetail
// deliberately omit from the general-purpose views. ADMIN-only
// (GET /access/audit/:accessLogId) — the general session detail view never
// needs this level of internals. Structurally matches the AuditEvent entity
// returned by AccessService.getAuditTrail(); kept as a separate type so the
// frontend contract doesn't depend on the entity shape directly.
export interface AuditTrailEventView {
  id: string;
  seq: string;
  accessLogId: string;
  eventType: AuditEventType;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  prevHash: string | null;
  hash: string;
}
