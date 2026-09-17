import { ApiProperty } from '@nestjs/swagger';
import { Ticket, TicketStatus, TicketType } from '../entities/ticket.entity';

// Response shape for POST /tickets/public — the one UNAUTHENTICATED endpoint
// in the whole ticket surface. NOT the raw Ticket entity: that carries
// `internalNotes` (staff-only free text) and `assignedTo`/`client`/`server`
// relations, none of which an anonymous lead submitter should ever see in
// their own confirmation response, even though for a brand-new public lead
// they're all still empty today — the contract should be safe by
// construction, not by coincidence of what happens to be null right now.
export class PublicTicketViewDto {
  id: string;
  subject: string;
  @ApiProperty({ enum: TicketType, enumName: 'TicketType' })
  type: TicketType;
  @ApiProperty({ enum: TicketStatus, enumName: 'TicketStatus' })
  status: TicketStatus;
  createdAt: Date;
}

export function toPublicTicketView(ticket: Ticket): PublicTicketViewDto {
  return {
    id: ticket.id,
    subject: ticket.subject,
    type: ticket.type,
    status: ticket.status,
    createdAt: ticket.createdAt,
  };
}
