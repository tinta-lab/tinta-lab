import {
  Server,
  ServerPublicStatus,
  ServerStatus,
} from '../entities/server.entity';

// Response shape for GET /servers and GET /servers/:id when the caller is
// ADMIN. Both endpoints previously returned the raw Server entity —
// tunnelToken/cfAccessAppId/cfDnsRecordId/tunnelId/localUrl included — on
// the reasoning that ADMIN is a trusted role. But a trusted role is not a
// reason to skip an explicit API contract (same principle P1.3 already
// applied everywhere else), and grepping every real ADMIN-reachable
// consumer found none reading those fields: admin/page.tsx only reads
// `.length`/`.accessEnabled` for a stats count, AccessLogFilters (shared
// with STAFF) only reads `.id`/`.name` for a dropdown, and GET /servers/:id
// has no frontend consumer at all today.
//
// Deliberately mirrors SupportServerViewDto's shape — not because ADMIN and
// SUPPORT have the same trust level, but because that's what ADMIN's actual
// consumers need today. Kept as its own named type (not a reuse of
// SupportServerViewDto) so the two role boundaries can diverge later
// without one accidentally widening the other. Distinct from
// AdminServerViewDto, which is the POST/PATCH create/update
// acknowledgement, not a read view.
export class AdminServerReadViewDto {
  id: string;
  name: string;
  subdomain: string;
  hubId: string | null;
  status: ServerStatus;
  publicStatus: ServerPublicStatus;
  publicCheckedAt: Date | null;
  accessEnabled: boolean;
  accessExpiresAt: Date | null;
  haVersion: string | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Never populated today (see toAdminServerReadView) — optional for the
  // same reason SupportServerViewDto.publicUrl is: not every caller
  // computes it. No current ADMIN consumer reads it.
  publicUrl?: string | null;
  client?: {
    id: string;
    user?: { id: string; firstName: string; lastName: string };
  };
}

export function toAdminServerReadView(
  server: Server & {
    client?: {
      id: string;
      user?: { id: string; firstName: string; lastName: string };
    } | null;
  },
): AdminServerReadViewDto {
  return {
    id: server.id,
    name: server.name,
    subdomain: server.subdomain,
    hubId: server.hubId,
    status: server.status,
    publicStatus: server.publicStatus,
    publicCheckedAt: server.publicCheckedAt,
    accessEnabled: server.accessEnabled,
    accessExpiresAt: server.accessExpiresAt,
    haVersion: server.haVersion,
    lastSeenAt: server.lastSeenAt,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
    client: server.client
      ? {
          id: server.client.id,
          user: server.client.user
            ? {
                id: server.client.user.id,
                firstName: server.client.user.firstName,
                lastName: server.client.user.lastName,
              }
            : undefined,
        }
      : undefined,
  };
}
