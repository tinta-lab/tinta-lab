import { TicketStatus } from './entities/ticket.entity';

// Role-agnostic — ADMIN does not bypass this. Keeps the audit trail
// meaningful (no "how did this go straight from NEW to CLOSED" question
// with no answer). from === to (no-op) is always allowed by
// isAllowedTicketStatusTransition below, handled separately by the caller
// since it needs different side effects (no audit message written).
export const ALLOWED_TICKET_STATUS_TRANSITIONS: Record<
  TicketStatus,
  TicketStatus[]
> = {
  [TicketStatus.NEW]: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
  [TicketStatus.IN_PROGRESS]: [
    TicketStatus.WAITING_CLIENT,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
  ],
  [TicketStatus.WAITING_CLIENT]: [
    TicketStatus.IN_PROGRESS,
    TicketStatus.RESOLVED,
    TicketStatus.CLOSED,
  ],
  [TicketStatus.RESOLVED]: [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS], // reopen
  [TicketStatus.CLOSED]: [], // terminal — no transitions out via this endpoint
};

export function isAllowedTicketStatusTransition(
  from: TicketStatus,
  to: TicketStatus,
): boolean {
  return from === to || ALLOWED_TICKET_STATUS_TRANSITIONS[from].includes(to);
}
