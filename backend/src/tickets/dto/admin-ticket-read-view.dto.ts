import { ApiProperty } from '@nestjs/swagger';
import { Ticket, TicketStatus, TicketType } from '../entities/ticket.entity';
import { Client } from '../../clients/entities/client.entity';
import { Server } from '../../servers/entities/server.entity';
import {
  AdminServerReadViewDto,
  toAdminServerReadView,
} from '../../servers/dto/admin-server-read-view.dto';

// Response shape for GET /tickets, GET /tickets/:id, and PATCH
// /tickets/:id/status when the caller is ADMIN. Previously the raw `Ticket`
// entity — Cloudflare infra secrets nested via `server`, full `assignedTo`
// User relation — on the "ADMIN is trusted" reasoning. Same pattern already
// corrected for servers.controller.ts in P1.4-B: a trusted role is still not
// a reason to skip an explicit API contract, and grepping the one real
// ADMIN-reachable consumer (admin/tickets/page.tsx) found it reads exactly
// the same fields StaffTicketViewDto covers — id/name/email/phone/subject/
// message/type/status/createdAt/server.name — nothing that needs the raw
// entity or its secrets.
//
// Kept as its own named type rather than a reuse of StaffTicketViewDto, for
// the same reason AdminServerReadViewDto is separate from
// SupportServerViewDto: the two role boundaries should be free to diverge
// later without one accidentally widening the other.
// `client` (id only) is kept for the same reason as StaffTicketViewDto's:
// GET /tickets?clientId= (Phase 0.2) needs it to be verifiable, and it's the
// documented dependency for the planned GET /clients/:id/360 aggregation.
export class AdminTicketReadViewDto {
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
  @ApiProperty({ type: () => AdminServerReadViewDto, nullable: true })
  server: AdminServerReadViewDto | null;
  client: { id: string } | null;
}

export function toAdminTicketReadView(
  ticket: Ticket & { server: Server | null; client: Client | null },
): AdminTicketReadViewDto {
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
    server: ticket.server ? toAdminServerReadView(ticket.server) : null,
    client: ticket.client ? { id: ticket.client.id } : null,
  };
}
