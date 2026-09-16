import {
  Server,
  ServerPublicStatus,
  ServerStatus,
} from '../entities/server.entity';

// Response shape for CLIENT-facing server views (GET /servers/my, and the
// `server` embedded in a client's own tickets). NOT the raw Server entity —
// that carries `tunnelToken`/`cfAccessAppId`/`cfDnsRecordId`/`tunnelId`
// (Cloudflare infra secrets) and `localUrl` (internal LAN address) as plain
// columns with no `select: false`, and this codebase has no
// ClassSerializerInterceptor to strip them before res.json(). Same principle
// already applied to servers.controller.ts's SUPPORT-facing findOne() —
// enforced here for CLIENT views, which must never see these fields at all.
export interface ClientServerView {
  id: string;
  name: string;
  subdomain: string;
  hubId: string | null;
  status: ServerStatus;
  publicStatus: ServerPublicStatus;
  accessEnabled: boolean;
  accessExpiresAt: Date | null;
  haVersion: string | null;
  lastSeenAt: Date | null;
  publicUrl?: string | null;
  createdAt: Date;
}

export function toClientServerView(
  server: Server & { publicUrl?: string | null },
): ClientServerView {
  return {
    id: server.id,
    name: server.name,
    subdomain: server.subdomain,
    hubId: server.hubId,
    status: server.status,
    publicStatus: server.publicStatus,
    accessEnabled: server.accessEnabled,
    accessExpiresAt: server.accessExpiresAt,
    haVersion: server.haVersion,
    lastSeenAt: server.lastSeenAt,
    publicUrl: server.publicUrl,
    createdAt: server.createdAt,
  };
}
