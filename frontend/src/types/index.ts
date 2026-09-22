import type { components } from '../generated/api';

// Sourced from the backend OpenAPI contract (components.schemas.UserRole) —
// not a hand-duplicated literal union. See P1.3-B.
export type UserRole = components['schemas']['UserRole'];

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

// Sourced from the backend OpenAPI contract — see P1.3-B.
export type AuthResponse = components['schemas']['AuthResponseDto'];

// Sourced from the backend OpenAPI contract — see P1.4-C. Three distinct
// role-scoped read views, deliberately never merged into one `Server`
// union type: the P1.4-A audit found the old hand-written `Server` claimed
// fields (`localUrl`, a full `Client`) that no real response ever actually
// carried, and a merged type would let code accidentally read a field only
// one role's view really returns. Pick the one matching the actual endpoint
// you're consuming, never a shared "Server".
export type ClientServer = components['schemas']['ClientServerViewDto'];
export type SupportServer = components['schemas']['SupportServerViewDto'];
export type AdminServerRead = components['schemas']['AdminServerReadViewDto'];

// POST /servers / PATCH /servers/:id acknowledgement — a mutation response,
// not a read view, kept separate from AdminServerRead for that reason.
export type AdminServerMutation = components['schemas']['AdminServerViewDto'];

// Sourced from the backend OpenAPI contract — see the Hub contract-
// completeness cleanup (P1.4 backlog item). GET /hubs / GET /hubs/:id are
// ADMIN-only with no sibling role view, so unlike ClientServer/StaffTicket
// etc. there's only one alias here, not a family. Replaces the hand-written
// `Hub`/`HubAgent` interfaces that used to live in admin/hubs/page.tsx —
// those had drifted from the real response (dead fields like `status`,
// `subdomain`, `cfAccessAppId`, `client.user.id`, `agent.lastHeartbeatAt`,
// `agent.metrics.uptimeSeconds` — see hub-view.dto.ts for the audit).
export type AdminHub = components['schemas']['HubViewDto'];

export interface Client {
  id: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  isInstalled: boolean;
  user: User;
}

export interface GoldenTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  requiredEntities: string[];
  isActive: boolean;
}

// Sourced from the backend OpenAPI contract — see P1.3-B.
export type TicketType = components['schemas']['TicketType'];
export type TicketStatus = components['schemas']['TicketStatus'];

// Sourced from the backend OpenAPI contract — see P1.4-D3. Role-scoped
// ticket views, same principle as ClientServer/SupportServer/AdminServerRead:
// never merged into one `Ticket` union — GET /tickets and GET /tickets/:id
// are a real, OpenAPI-documented `oneOf` on the backend (P1.4-D1), so a
// frontend union would just hide that boundary again.
export type ClientTicket = components['schemas']['ClientTicketViewDto'];
export type ClientTicketDetail = components['schemas']['ClientTicketDetailViewDto'];
export type StaffTicket = components['schemas']['StaffTicketViewDto'];
export type AdminTicket = components['schemas']['AdminTicketReadViewDto'];

// Sourced from the backend OpenAPI contract — see P1.4-D3. Distinct per
// role for the same reason as the ticket views above: StaffTicketMessage
// carries `internal`, ClientTicketMessage never does (the client-facing DTO
// has no such field — see P1.4-D2).
export type ClientTicketMessage = components['schemas']['ClientTicketMessageViewDto'];
export type StaffTicketMessage = components['schemas']['StaffTicketMessageViewDto'];

// Sourced from the backend OpenAPI contract — see P1.3-B.
export type AuditEventType = components['schemas']['AuditEventType'];

// Sourced from the backend OpenAPI contract — see P1.3-B7.
export type AccessEventView = components['schemas']['AccessEventViewDto'];

// Sourced from the backend OpenAPI contract — see P1.3-B7.
export type AccessEventPage = components['schemas']['AccessEventPageDto'];

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

// Sourced from the backend OpenAPI contract — see P1.3-B.
export type AccessLogDetail = components['schemas']['AccessLogDetailDto'];

// Sourced from the backend OpenAPI contract — see P1.3-B.
export type ClientAccessLogView = components['schemas']['ClientAccessLogViewDto'];

// Sourced from the backend OpenAPI contract — see P1.3-B.
export type AuditTrailEventView = components['schemas']['AuditTrailEventViewDto'];

// Sourced from the backend OpenAPI contract — see P1.3-B.
export type AuditChainVerification = components['schemas']['AuditChainVerificationDto'];

// Sourced from the backend OpenAPI contract — Phase 1.3 Diagnostics Center
// (PHASE1_3_DIAGNOSTICS_SPEC.md). `status`/`code`/`evidence` are the
// backend's judgment — the frontend must never recompute a status from raw
// fields (e.g. no `if cpu > 80` logic client-side); that judgment lives
// entirely in the backend check layer. `title`/`message` are English text
// kept only for backward compatibility (unknown-code fallback) — as of
// 2026-09-22 the frontend renders localized text built from `code` (+
// `evidence` for the few dynamic messages) via
// frontend/src/lib/diagnosticText.ts, never `title`/`message` directly.
// See PHASE1_3_DIAGNOSTICS_SPEC.md's evidence field list for what
// `evidence` carries per check, including `affectedResources` (added
// alongside this change specifically so the frontend never has to
// re-derive which resource crossed which threshold to translate the
// RESOURCE_CRITICAL/HIGH_USAGE message).
export type DiagnosticStatus = components['schemas']['DiagnosticStatus'];
export type DiagnosticCheckKey = components['schemas']['DiagnosticCheckKey'];
export type DiagnosticCheck = components['schemas']['DiagnosticCheckDto'];
export type DiagnosticClientRef = components['schemas']['DiagnosticClientRefDto'];
export type DiagnosticServerRef = components['schemas']['DiagnosticServerRefDto'];
export type DiagnosticHubRef = components['schemas']['DiagnosticHubRefDto'];
export type ClientDiagnostics = components['schemas']['ClientDiagnosticsDto'];
