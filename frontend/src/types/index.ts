export type UserRole = 'admin' | 'support' | 'sales' | 'client';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface Server {
  id: string;
  name: string;
  subdomain: string;
  publicUrl?: string | null;
  status: 'online' | 'offline' | 'unknown';
  publicStatus?: 'reachable' | 'unreachable' | 'unknown';
  publicCheckedAt?: string | null;
  accessEnabled: boolean;
  accessExpiresAt: string | null;
  lastSeenAt: string | null;
  haVersion: string | null;
  localUrl: string | null;
  client?: Client;
}

export interface Client {
  id: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  isInstalled: boolean;
  user: User;
}

export interface AgentMetrics {
  cpuPercent: number;
  memPercent: number;
  diskPercent: number;
  deviceCount: number;
  automationCount: number;
  uptimeSeconds: number;
}

export interface AgentSession {
  id: string;
  clientId: string;
  status: 'connected' | 'disconnected';
  agentVersion: string | null;
  haVersion: string | null;
  appliedTemplates: string[];
  metrics: AgentMetrics | null;
  lastConnectedAt: string | null;
  lastHeartbeatAt: string | null;
  lastTokenMismatchAt: string | null;
  createdAt: string;
  client?: Client;
}

export interface GoldenTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  requiredEntities: string[];
  isActive: boolean;
}

export type TicketType = 'installation' | 'support' | 'sales' | 'other';
export type TicketStatus = 'new' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed';

export interface Ticket {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  type: TicketType;
  status: TicketStatus;
  assignedTo?: User;
  internalNotes?: string;
  // Set only for tickets created through the authenticated client portal
  // (POST /tickets) — null/absent for public contact-form leads.
  client?: Client | null;
  server?: Server | null;
  createdAt: string;
  updatedAt: string;
}

// `internal` is optional and unused by client-facing code: GET
// /tickets/mine/:id and POST /tickets/:id/messages (client role) only ever
// produce/accept non-internal messages (the backend DTO for that role has
// no such field), so the value is always false there and client components
// never read it. Staff-facing code (GET /tickets/:id/messages) does need it
// to distinguish public replies from internal notes.
export interface TicketMessage {
  id: string;
  message: string;
  authorRole: UserRole;
  internal?: boolean;
  author?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

export interface TicketWithMessages extends Ticket {
  messages: TicketMessage[];
}

// Mirrors backend/src/access/entities/audit-event.entity.ts's AuditEventType.
export type AuditEventType =
  | 'granted'
  | 'connected'
  | 'activity_log'
  | 'security_anomaly'
  | 'revoked'
  | 'expired';

// Mirrors backend/src/access/dto/access-event-view.dto.ts's AccessEventView —
// one row per audit_events row, joined with just enough access_logs/servers/
// clients/tickets context for display. Never the raw entities.
export interface AccessEventView {
  id: string;
  seq: string;
  eventType: AuditEventType;
  createdAt: string;
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

export interface AccessLogsFilters {
  serverId?: string;
  clientId?: string;
  staffId?: string;
  ticketId?: string;
  eventType?: AuditEventType;
  dateFrom?: string;
  dateTo?: string;
  skip?: number;
  take?: number;
}

// Mirrors AccessLogDetail — the GET /access/sessions/:accessLogId response:
// full session lifecycle plus its ordered audit_events chain.
export interface AccessLogDetail {
  id: string;
  grantedAt: string;
  expiresAt: string;
  connectedAt: string | null;
  revokedAt: string | null;
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
    createdAt: string;
  }[];
}

// Mirrors ClientAccessLogView — the CLIENT-facing GET /access/my-logs shape
// (deliberately never the raw AccessLog entity — see the 2026-09-03 hotfix).
export interface ClientAccessLogView {
  id: string;
  grantedAt: string;
  expiresAt: string;
  connectedAt: string | null;
  revokedAt: string | null;
  isRevoked: boolean;
  reason: string | null;
  reasonCode: string | null;
  reasonDetails: string | null;
  activityLog: string[] | null;
  grantedBy: { firstName: string; lastName: string } | null;
  accessedBy: { firstName: string; lastName: string } | null;
  server: { id: string; name: string } | null;
  ticket: { id: string; subject: string; status: TicketStatus } | null;
}

// Mirrors backend/src/access/dto/audit-trail-view.dto.ts — ADMIN-only
// cryptographic view of one audit_events row (GET /access/audit/:accessLogId).
export interface AuditTrailEventView {
  id: string;
  seq: string;
  accessLogId: string;
  eventType: AuditEventType;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  prevHash: string | null;
  hash: string;
}

// Mirrors AuditLogService.verifyChain()'s return shape (GET /access/audit-verify).
export interface AuditChainVerification {
  valid: boolean;
  brokenAtEventId?: string;
}
