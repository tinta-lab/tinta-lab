import api from '@/lib/api';
import { Ticket, TicketMessage, TicketStatus } from '@/types';

// STAFF-scoped ticket API (ADMIN/SALES/SUPPORT) — distinct from
// services/supportApi.ts, which is the CLIENT-scoped API hitting
// /tickets/mine/*. These hit the unrestricted-by-ownership /tickets/*
// routes; RolesGuard on the backend is what actually enforces who may call
// them, same as every other staff-facing call in this app.
export const staffTicketsApi = {
  getAll: (status?: TicketStatus, clientId?: string) =>
    api
      .get<Ticket[]>('/tickets', { params: { status, clientId } })
      .then((r) => r.data),

  getById: (id: string) => api.get<Ticket>(`/tickets/${id}`).then((r) => r.data),

  getMessages: (id: string) =>
    api.get<TicketMessage[]>(`/tickets/${id}/messages`).then((r) => r.data),

  addMessage: (id: string, message: string, internal: boolean) =>
    api.post<TicketMessage>(`/tickets/${id}/messages`, { message, internal }).then((r) => r.data),

  updateStatus: (id: string, status: TicketStatus, internalNotes?: string) =>
    api.patch<Ticket>(`/tickets/${id}/status`, { status, internalNotes }).then((r) => r.data),
};
