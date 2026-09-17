import api from '@/lib/api';
import { ClientTicket, ClientTicketDetail, ClientTicketMessage, TicketType } from '@/types';

export interface CreateTicketPayload {
  type: TicketType;
  subject: string;
  description: string;
  serverId: string;
}

// Thin wrapper around the CLIENT-scoped ticket API — every call rides the
// httpOnly JWT cookie (see lib/api.ts), never a client-supplied id. None of
// these accept or return an `internal` field: the backend DTO for this role
// (CreateTicketMessageDto) has no such field, so there is nothing to strip
// here — the client UI simply never has the concept.
//
// Every generic below used to type the real ClientTicketViewDto/
// ClientTicketDetailViewDto/ClientTicketMessageViewDto responses as the
// generic Ticket/TicketWithMessages — see P1.4-D3.
export const supportApi = {
  createTicket: (payload: CreateTicketPayload) =>
    api.post<ClientTicket>('/tickets', payload).then((r) => r.data),

  getMyTickets: () => api.get<ClientTicket[]>('/tickets/mine').then((r) => r.data),

  getMyTicket: (id: string) =>
    api.get<ClientTicketDetail>(`/tickets/mine/${id}`).then((r) => r.data),

  addMessage: (id: string, message: string) =>
    api.post<ClientTicketMessage>(`/tickets/${id}/messages`, { message }).then((r) => r.data),
};
