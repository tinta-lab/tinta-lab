import { Server, ServerPublicStatus, ServerStatus } from '../entities/server.entity';

// Response shape for SUPPORT-facing server views (GET /servers list + GET
// /servers/:id, when the caller is SUPPORT rather than ADMIN). SUPPORT is a
// trusted staff role but still must not receive Cloudflare infra secrets
// (`tunnelToken`/`cfAccessAppId`/`cfDnsRecordId`/`tunnelId`) or the internal
// LAN `localUrl` — those aren't needed for support work and shouldn't be in
// a response body regardless of role. Centralizes what findOne() previously
// did inline (and which omitted `cfAccessAppId`) so both the list and detail
// routes strip the same fields.
export class SupportServerViewDto {
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
  // findAccessibleForSupport() spreads this in separately (server list needs
  // the public hostname computed via getPublicHostname()); optional so
  // callers that don't compute it (e.g. findOne()) aren't forced to.
  publicUrl?: string | null;
  client?: {
    id: string;
    user?: { id: string; firstName: string; lastName: string };
  };
}

export function toSupportServerView<
  T extends Server & {
    client?: {
      id: string;
      user?: { id: string; firstName: string; lastName: string };
    } | null;
  },
>(server: T): SupportServerViewDto {
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
