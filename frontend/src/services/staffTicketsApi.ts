import api from '@/lib/api';
import { AdminTicket, StaffTicket, StaffTicketMessage, TicketStatus } from '@/types';

// STAFF-scoped ticket API — distinct from services/supportApi.ts, which is
// the CLIENT-scoped API hitting /tickets/mine/*. These hit the
// unrestricted-by-ownership /tickets/* routes; RolesGuard on the backend is
// what actually enforces who may call them.
//
// getAll/getById/updateStatus are typed `StaffTicket | AdminTicket`, NOT
// just `StaffTicket` — despite the "STAFF-scoped" name, these three hit a
// genuinely role-dependent backend oneOf (P1.4-D1), and ADMIN really does
// reach them through this same wrapper: StaffTicketsLayout's
// ALLOWED_ROLES and dashboard/support/page.tsx's guard both let 'admin'
// through to /dashboard/support/tickets[/:id], which call these methods.
// Typing this as plain StaffTicket would be a lie whenever an admin user is
// the one calling it — see the P1.4-D3 role-dependent-response note.
//
// getMessages/addMessage don't have this problem: GET/POST
// /tickets/:id/messages return StaffTicketMessageViewDto for every non-CLIENT
// role uniformly (see P1.4-D2) — there is no separate Admin message view.
export const staffTicketsApi = {
  getAll: (status?: TicketStatus, clientId?: string) =>
    api
      .get<(StaffTicket | AdminTicket)[]>('/tickets', { params: { status, clientId } })
      .then((r) => r.data),

  getById: (id: string) =>
    api.get<StaffTicket | AdminTicket>(`/tickets/${id}`).then((r) => r.data),

  getMessages: (id: string) =>
    api.get<StaffTicketMessage[]>(`/tickets/${id}/messages`).then((r) => r.data),

  addMessage: (id: string, message: string, internal: boolean) =>
    api.post<StaffTicketMessage>(`/tickets/${id}/messages`, { message, internal }).then((r) => r.data),

  updateStatus: (id: string, status: TicketStatus, internalNotes?: string | null) =>
    api
      .patch<StaffTicket | AdminTicket>(`/tickets/${id}/status`, { status, internalNotes })
      .then((r) => r.data),
};
