import { AuditEventType } from '../entities/audit-event.entity';

// One row per audit_events row — the new Access Logs admin/staff view is
// event-level (GRANTED/CONNECTED/REVOKED/EXPIRED/SECURITY_ANOMALY/
// ACTIVITY_LOG), not session-level, so filters like eventType map directly
// onto real columns instead of a derived status. access_logs stays the
// session-level context (grantedAt/expiresAt/revokedAt/ticket/duration) —
// joined in here for display, and available in full via the drill-down
// endpoint (GET /access/logs/:accessLogId).
export interface AccessEventView {
  id: string;
  seq: string;
  eventType: AuditEventType;
  createdAt: Date;
  accessLogId: string;
  metadata: Record<string, unknown> | null;
  actor: { id: string; firstName: string; lastName: string } | null;
  server: { id: string; name: string } | null;
  client: { id: string; firstName: string; lastName: string } | null;
  ticket: { id: string; subject: string } | null;
}

export interface AccessEventPage {
  data: AccessEventView[];
  total: number;
}

// Session-level drill-down for one access_logs row (GET /access/logs/:id) —
// its full lifecycle fields plus the ordered audit_events chain for it.
export interface AccessLogDetail {
  id: string;
  grantedAt: Date;
  expiresAt: Date;
  connectedAt: Date | null;
  revokedAt: Date | null;
  isRevoked: boolean;
  reasonCode: string | null;
  reasonDetails: string | null;
  reason: string | null;
  grantedBy: { id: string; firstName: string; lastName: string } | null;
  accessedBy: { id: string; firstName: string; lastName: string } | null;
  server: { id: string; name: string } | null;
  client: { id: string; firstName: string; lastName: string } | null;
  ticket: { id: string; subject: string } | null;
  events: {
    id: string;
    seq: string;
    eventType: AuditEventType;
    actorUserId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
  }[];
}
