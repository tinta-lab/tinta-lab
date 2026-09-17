import { ApiProperty } from '@nestjs/swagger';
import { Ticket, TicketStatus, TicketType } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { UserRole } from '../../users/entities/user.entity';
import {
  ClientServerViewDto,
  toClientServerView,
} from '../../servers/dto/client-server-view.dto';
import { Server } from '../../servers/entities/server.entity';

// Response shape for CLIENT-facing ticket views (GET /tickets/mine, GET
// /tickets/mine/:id) — NOT the raw Ticket entity. Ticket carries
// `internalNotes` (staff-only free text, written via PATCH /tickets/:id/status)
// as a plain column, and its `server` relation is the full Server entity
// with Cloudflare infra secrets (see servers/dto/client-server-view.dto.ts).
// This codebase has no ClassSerializerInterceptor, so returning the entity
// (or `{ ...ticket }`) directly leaks both. Same principle as
// access/dto/client-access-log-view.dto.ts, applied here for tickets.
export class ClientTicketViewDto {
  id: string;
  subject: string;
  message: string;
  @ApiProperty({ enum: TicketType, enumName: 'TicketType' })
  type: TicketType;
  @ApiProperty({ enum: TicketStatus, enumName: 'TicketStatus' })
  status: TicketStatus;
  createdAt: Date;
  updatedAt: Date;
  server: ClientServerViewDto | null;
}

// Named instead of an inline `{ ... } | null` object-literal type — the
// Swagger CLI plugin's implicit inference drops `nullable` for inline
// nested object types (only primitives get it right without an explicit
// decorator). See access/dto/access-event-view.dto.ts for the same pattern.
export class TicketMessageAuthorRefDto {
  id: string;
  firstName: string;
  lastName: string;
}

// TicketMessage.author is a full User relation (email, role, isActive,
// passwordChangedAt — password itself is `select: false` so at least that's
// safe by default). None of that belongs in a client response either.
export class ClientTicketMessageViewDto {
  id: string;
  message: string;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  authorRole: TicketMessage['authorRole'];
  @ApiProperty({ type: () => TicketMessageAuthorRefDto, nullable: true })
  author: TicketMessageAuthorRefDto | null;
  createdAt: Date;
}

export class ClientTicketDetailViewDto extends ClientTicketViewDto {
  messages: ClientTicketMessageViewDto[];
}

export function toClientTicketMessageView(
  msg: TicketMessage,
): ClientTicketMessageViewDto {
  return {
    id: msg.id,
    message: msg.message,
    authorRole: msg.authorRole,
    author: msg.author
      ? {
          id: msg.author.id,
          firstName: msg.author.firstName,
          lastName: msg.author.lastName,
        }
      : null,
    createdAt: msg.createdAt,
  };
}

export function toClientTicketView(
  ticket: Ticket & { server: Server | null },
): ClientTicketViewDto {
  return {
    id: ticket.id,
    subject: ticket.subject,
    message: ticket.message,
    type: ticket.type,
    status: ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    server: ticket.server ? toClientServerView(ticket.server) : null,
  };
}
