import { ApiProperty } from '@nestjs/swagger';
import { AccessReason } from '../enums/access-reason.enum';
import { TicketStatus } from '../../tickets/entities/ticket.entity';

// Nested ref shapes below — named classes instead of inline `{ ... } | null`
// object-literal types, because the Swagger CLI plugin's implicit inference
// drops `nullable` for inline nested object types (confirmed: only
// primitives get it right without an explicit decorator). See
// access-event-view.dto.ts for the same pattern applied to AccessLogDetailDto.
export class ClientAccessLogPersonRefDto {
  firstName: string;
  lastName: string;
}

export class ClientAccessLogServerRefDto {
  id: string;
  name: string;
}

export class ClientAccessLogTicketRefDto {
  id: string;
  subject: string;
  @ApiProperty({ enum: TicketStatus, enumName: 'TicketStatus' })
  status: TicketStatus;
}

// Response shape for GET /access/my-logs (CLIENT-facing) — deliberately NOT
// the raw AccessLog entity with its relations. TypeORM's `find({ relations
// })` loads full related entities, and this codebase has no
// ClassSerializerInterceptor anywhere to strip fields before they hit
// res.json() — so returning entities directly would leak whatever columns
// those relations carry. Concretely: Ticket has `internalNotes` (staff-only
// free text) and Server has `tunnelToken`/`cfAccessAppId`/`cfDnsRecordId`
// (Cloudflare infra secrets). Neither belongs in a client response, even
// scoped to the client's own resources — same principle already applied to
// servers.controller.ts's SUPPORT-facing findOne(), just enforced here for
// the CLIENT-facing log view instead.
export class ClientAccessLogViewDto {
  id: string;
  grantedAt: Date;
  expiresAt: Date;
  connectedAt: Date | null;
  revokedAt: Date | null;
  isRevoked: boolean;
  // Legacy free-text reason — see access-reason.enum.ts. Kept for old rows.
  reason: string | null;
  reasonCode: AccessReason | null;
  reasonDetails: string | null;
  activityLog: string[] | null;
  @ApiProperty({ type: () => ClientAccessLogPersonRefDto, nullable: true })
  grantedBy: ClientAccessLogPersonRefDto | null;
  @ApiProperty({ type: () => ClientAccessLogPersonRefDto, nullable: true })
  accessedBy: ClientAccessLogPersonRefDto | null;
  @ApiProperty({ type: () => ClientAccessLogServerRefDto, nullable: true })
  server: ClientAccessLogServerRefDto | null;
  @ApiProperty({ type: () => ClientAccessLogTicketRefDto, nullable: true })
  ticket: ClientAccessLogTicketRefDto | null;
}
