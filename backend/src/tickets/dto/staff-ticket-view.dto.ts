import { ApiProperty } from '@nestjs/swagger';
import { Ticket, TicketStatus, TicketType } from '../entities/ticket.entity';
import { Client } from '../../clients/entities/client.entity';
import { Server } from '../../servers/entities/server.entity';
import {
  SupportServerViewDto,
  toSupportServerView,
} from '../../servers/dto/support-server-view.dto';

// Response shape for GET /tickets, GET /tickets/:id, and PATCH
// /tickets/:id/status when the caller is SUPPORT/SALES — NOT the previous
// `{ ...ticket, server: toSupportServerView(...) }` inline object literal.
// That spread has no OpenAPI schema at all: the Swagger CLI plugin can't
// resolve an inline object-literal return type, so all three endpoints
// generated `Record<string, never>` in OpenAPI (see the P1.4-D audit) —
// same root cause as access-event-view.dto.ts before P1.3-B7.
//
// Fields checked against every real SUPPORT/SALES consumer (admin/tickets,
// sales, support/tickets[/:id] pages — see the audit): `assignedTo` is a
// real column on the raw entity, but grep found zero frontend reads of it
// anywhere. Not included here — add it back (and to the `relations` load in
// tickets.service.ts, which currently loads it for nothing) if a real
// consumer ever needs it. List and detail share one DTO deliberately: the
// detail page's field needs (email, whole server, internalNotes) are a
// superset of the list card's (name/type/server.name/createdAt/status), not
// a different shape.
//
// `client` IS kept, unlike `assignedTo` — no screen renders it today either,
// but GET /tickets?clientId= (Phase 0.2, see PHASE0_PHASE1_SPEC.md) is a
// real, already-shipped feature whose only way to verify it actually
// filtered is checking the returned tickets' client id, and it's the
// documented dependency for the planned GET /clients/:id/360 aggregation
// (Phase 1.5) — unlike assignedTo, this isn't a guess at future need.
export class StaffTicketViewDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  @ApiProperty({ enum: TicketType, enumName: 'TicketType' })
  type: TicketType;
  @ApiProperty({ enum: TicketStatus, enumName: 'TicketStatus' })
  status: TicketStatus;
  internalNotes: string | null;
  createdAt: Date;
  @ApiProperty({ type: () => SupportServerViewDto, nullable: true })
  server: SupportServerViewDto | null;
  client: { id: string } | null;
}

export function toStaffTicketView(
  ticket: Ticket & { server: Server | null; client: Client | null },
): StaffTicketViewDto {
  return {
    id: ticket.id,
    name: ticket.name,
    email: ticket.email,
    phone: ticket.phone ?? null,
    subject: ticket.subject,
    message: ticket.message,
    type: ticket.type,
    status: ticket.status,
    internalNotes: ticket.internalNotes ?? null,
    createdAt: ticket.createdAt,
    server: ticket.server ? toSupportServerView(ticket.server) : null,
    client: ticket.client ? { id: ticket.client.id } : null,
  };
}
