import api from '@/lib/api';
import {
  AccessEventPage,
  AccessLogDetail,
  AccessLogsFilters,
  AuditChainVerification,
  AuditTrailEventView,
  ClientAccessLogView,
} from '@/types';

// Thin wrapper around the Access Logs backend — components never call `api`
// directly for this domain. Role/scope enforcement lives entirely on the
// backend (ADMIN global, SUPPORT/SALES ticket-scoped, staffId dropped for
// non-ADMIN) — this layer just shapes requests/responses, it does not decide
// who can see what.
export const accessApi = {
  // GET /access/logs — ADMIN: global, filterable. SUPPORT/SALES: same call,
  // scoped server-side to tickets they participated on.
  getAccessLogs: (filters: AccessLogsFilters = {}) =>
    api.get<AccessEventPage>('/access/logs', { params: filters }).then((r) => r.data),

  // GET /access/sessions/:accessLogId — session drill-down + its event chain.
  getAccessSession: (accessLogId: string) =>
    api.get<AccessLogDetail>(`/access/sessions/${accessLogId}`).then((r) => r.data),

  // GET /access/my-logs — CLIENT's own history, already shaped server-side.
  getMyAccessLogs: () =>
    api.get<ClientAccessLogView[]>('/access/my-logs').then((r) => r.data),

  // DELETE /access/revoke/:serverId — ends a currently-open session early.
  // Same endpoint SupportAccessCard/admin hubs already use; kept here too so
  // Security Center screens don't call `api` directly for this domain either.
  revokeAccess: (serverId: string) =>
    api.delete(`/access/revoke/${serverId}`).then((r) => r.data),

  // GET /access/audit/:accessLogId — ADMIN-only cryptographic trail (hash
  // chain fields) for one session's events.
  getAuditTrail: (accessLogId: string) =>
    api.get<AuditTrailEventView[]>(`/access/audit/${accessLogId}`).then((r) => r.data),

  // GET /access/audit-verify — ADMIN-only: verify the whole ledger's hash
  // chain hasn't been tampered with.
  verifyAuditChain: () =>
    api.get<AuditChainVerification>('/access/audit-verify').then((r) => r.data),
};
