import { ApiProperty } from '@nestjs/swagger';
import { TicketMessage } from '../entities/ticket-message.entity';
import { UserRole } from '../../users/entities/user.entity';
import { TicketMessageAuthorRefDto } from './client-ticket-view.dto';

// Response shape for POST /tickets/:id/messages and GET
// /tickets/:id/messages when the caller is STAFF (ADMIN/SALES/SUPPORT) —
// NOT the raw TicketMessage entity. That carries `ticket: Ticket` (full
// entity; the P1.4-D audit found zero frontend reads of it — the route
// already carries the ticket id in its own path) and `author: User` (full
// entity minus password via select:false, though StaffMessageList only ever
// reads firstName/lastName). One shape for both endpoints deliberately —
// they'd drifted apart for no functional reason (POST returned a stub
// `author: {id}`, GET returned the full User) — see tickets.service.ts's
// addStaffMessage for how `author` gets populated on create without faking
// data that isn't there.
export class StaffTicketMessageViewDto {
  id: string;
  message: string;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  authorRole: TicketMessage['authorRole'];
  internal: boolean;
  @ApiProperty({ type: () => TicketMessageAuthorRefDto, nullable: true })
  author: TicketMessageAuthorRefDto | null;
  createdAt: Date;
}

export function toStaffTicketMessageView(
  msg: Pick<TicketMessage, 'id' | 'message' | 'authorRole' | 'internal' | 'createdAt'>,
  author: { id: string; firstName: string; lastName: string } | null,
): StaffTicketMessageViewDto {
  return {
    id: msg.id,
    message: msg.message,
    authorRole: msg.authorRole,
    internal: msg.internal,
    author: author
      ? { id: author.id, firstName: author.firstName, lastName: author.lastName }
      : null,
    createdAt: msg.createdAt,
  };
}
