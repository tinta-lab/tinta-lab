import {
  Server,
  ServerPublicStatus,
  ServerStatus,
} from '../entities/server.entity';

// Response shape for POST /servers and PATCH /servers/:id (both ADMIN-only).
// Checked against the actual frontend before writing this: neither endpoint
// is currently called by admin/hubs/page.tsx (server creation there goes
// through POST /provisioning/client instead) or any other audited consumer,
// so nothing reads tunnelToken/cfAccessAppId/cfDnsRecordId/localUrl off
// these two responses today — stripping them here changes no runtime
// behavior for any real caller. Kept separate from ClientServerView/
// SupportServerView rather than reusing one of those: this is the ADMIN
// create/update acknowledgement (needs status/timestamps, not the
// client-relation summary those two carry).
export class AdminServerViewDto {
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
}

export function toAdminServerView(server: Server): AdminServerViewDto {
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
  };
}
