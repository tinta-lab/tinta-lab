import { TicketStatus } from '@/types';

// Mirrors backend/src/tickets/ticket-status.transitions.ts — kept as a
// manual mirror since this codebase has no shared types package (see the
// same convention for every type in frontend/src/types/index.ts). Used only
// to disable buttons for a transition the backend would reject anyway; the
// backend's own check is the actual enforcement.
export const ALLOWED_TICKET_STATUS_TRANSITIONS: Record<
  TicketStatus,
  TicketStatus[]
> = {
  new: ['in_progress', 'closed'],
  in_progress: ['waiting_client', 'resolved', 'closed'],
  waiting_client: ['in_progress', 'resolved', 'closed'],
  resolved: ['closed', 'in_progress'],
  closed: [],
};

export function isAllowedTicketStatusTransition(
  from: TicketStatus,
  to: TicketStatus,
): boolean {
  return from === to || ALLOWED_TICKET_STATUS_TRANSITIONS[from].includes(to);
}
