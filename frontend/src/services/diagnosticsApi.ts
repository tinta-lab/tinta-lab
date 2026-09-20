import api from '@/lib/api';
import { ClientDiagnostics } from '@/types';

// Thin wrapper around the Diagnostics Center backend — same convention as
// services/access.api.ts. Role/ownership enforcement lives entirely on the
// backend (ADMIN unrestricted, SUPPORT scoped to clients with an
// accessEnabled server, CLIENT never reaches this route at all — see
// lib/permissions.ts's canViewDiagnostics for the route-level gate); this
// layer just shapes the request/response.
export const diagnosticsApi = {
  // GET /clients/:clientId/diagnostics
  getClientDiagnostics: (clientId: string) =>
    api
      .get<ClientDiagnostics>(`/clients/${clientId}/diagnostics`)
      .then((r) => r.data),
};
