import { AccessLog } from '../entities/access-log.entity';

// Response shape for POST /access/grant/:serverId — NOT the raw AccessLog
// entity. That carries `supportPassword` in plaintext (the credential this
// same grant just generated for SUPPORT to use via POST /access/connect),
// as a plain column with no `select: false`. This route is CLIENT-callable
// (a client granting access to their own server), and the frontend never
// reads this response body anyway (SupportAccessCard just reloads after
// posting) — so the password has no reason to leave the server at grant
// time. It reaches the caller correctly through the separate
// SUPPORT/ADMIN-only connect route instead.
export class AccessGrantViewDto {
  id: string;
  grantedAt: Date;
  expiresAt: Date;
  isRevoked: boolean;
  reasonCode: string | null;
  reasonDetails: string | null;
}

export function toAccessGrantView(log: AccessLog): AccessGrantViewDto {
  return {
    id: log.id,
    grantedAt: log.grantedAt,
    expiresAt: log.expiresAt,
    isRevoked: log.isRevoked,
    reasonCode: log.reasonCode,
    reasonDetails: log.reasonDetails,
  };
}
