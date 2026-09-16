import { AccessReason } from '../enums/access-reason.enum';
import { TicketStatus } from '../../tickets/entities/ticket.entity';

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
export interface ClientAccessLogView {
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
  grantedBy: { firstName: string; lastName: string } | null;
  accessedBy: { firstName: string; lastName: string } | null;
  server: { id: string; name: string } | null;
  ticket: { id: string; subject: string; status: TicketStatus } | null;
}
