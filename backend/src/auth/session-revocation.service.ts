import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { RevokedSession } from './entities/revoked-session.entity';
import { UsersService } from '../users/users.service';

export interface SessionTokenPayload {
  sub: string;
  sid?: string;
  iat?: number;
  exp?: number;
}

// Bounds how long an authenticated request can wait on the auth lookup —
// past this the request fails with 503 instead of hanging.
export const AUTH_CHECK_TIMEOUT_MS = 3000;

// Extra lifetime for a revocation row beyond the session's newest possible
// token, so clock skew between issue and check can't let a token outlive it.
const REVOCATION_MARGIN_MS = 60_000;

// Single place that decides whether a JWT's session is still usable — used by
// JwtStrategy (HTTP) and the /servers WS gateway — and that records logouts.
//
// Replaces the Redis TokenBlacklistService, which failed OPEN: with Redis
// unreachable every request hung ~10s and then a revoked token was accepted
// (and re-issued fresh by the sliding session). This fails CLOSED: if the
// check can't be made, the request is refused with 503.
@Injectable()
export class SessionRevocationService {
  private readonly logger = new Logger(SessionRevocationService.name);

  // Notified after a revocation is recorded — the /servers WS gateway uses
  // it to drop connections that were authenticated under that session
  // (connect-time auth alone would let them run on). In-process only, which
  // is enough while the backend runs as one PM2 fork-mode process; with
  // several instances this needs a shared channel (e.g. Postgres
  // LISTEN/NOTIFY).
  private readonly revokedListeners = new Set<(sessionId: string) => void>();

  constructor(
    @InjectRepository(RevokedSession)
    private readonly revoked: Repository<RevokedSession>,
    private readonly usersService: UsersService,
  ) {}

  onRevoked(listener: (sessionId: string) => void): () => void {
    this.revokedListeners.add(listener);
    return () => this.revokedListeners.delete(listener);
  }

  async assertSessionValid(payload: SessionTokenPayload): Promise<void> {
    // Tokens issued before sessions existed (and any non-session JWT) carry
    // no sid, so they can't be revoked individually — refuse them; the
    // client just signs in again.
    if (!payload.sid) {
      throw new UnauthorizedException('Session expired, please sign in again');
    }

    let meta: Awaited<ReturnType<UsersService['getAuthMeta']>>;
    let isRevoked: boolean;
    try {
      [meta, isRevoked] = await withTimeout(
        Promise.all([
          this.usersService.getAuthMeta(payload.sub),
          this.revoked.exists({ where: { sessionId: payload.sid } }),
        ]),
        AUTH_CHECK_TIMEOUT_MS,
      );
    } catch (err) {
      this.logger.error(
        `auth check unavailable user=${payload.sub} sid=${payload.sid}: ${errorMessage(err)}`,
      );
      throw new ServiceUnavailableException(
        'Authorization temporarily unavailable',
      );
    }

    if (!meta || !meta.isActive) {
      throw new UnauthorizedException('Account is not active');
    }
    if (isRevoked) {
      throw new UnauthorizedException('Session has been revoked');
    }
    // Reject tokens issued before the user's last password change — closes
    // the window where a leaked token would otherwise outlive a reset.
    if (meta.passwordChangedAt && payload.iat) {
      const changedAtSeconds = Math.floor(
        meta.passwordChangedAt.getTime() / 1000,
      );
      if (payload.iat < changedAtSeconds) {
        throw new UnauthorizedException('Token invalidated by password change');
      }
    }
  }

  // Revokes the whole session, i.e. every token the sliding session has
  // issued under this sid. Throws 503 if it can't be recorded, so logout is
  // never reported as done when it wasn't.
  async revoke(payload: SessionTokenPayload): Promise<void> {
    if (!payload.sid) return; // nothing revocable (assertSessionValid refuses these anyway)

    // Every token of this session was issued at or before now, so none can
    // be valid past now + its TTL.
    const ttlMs =
      payload.exp && payload.iat
        ? (payload.exp - payload.iat) * 1000
        : 15 * 60 * 1000;
    const now = Date.now();
    try {
      await this.revoked
        .createQueryBuilder()
        .insert()
        .values({
          sessionId: payload.sid,
          userId: payload.sub,
          revokedAt: new Date(now),
          expiresAt: new Date(now + ttlMs + REVOCATION_MARGIN_MS),
        })
        .orIgnore() // already revoked (e.g. a double logout) is fine
        .execute();
    } catch (err) {
      this.logger.error(
        `logout NOT recorded user=${payload.sub} sid=${payload.sid}: ${errorMessage(err)}`,
      );
      throw new ServiceUnavailableException(
        'Logout could not be completed, please try again',
      );
    }

    for (const listener of this.revokedListeners) {
      try {
        listener(payload.sid);
      } catch (err) {
        this.logger.warn(
          `revocation listener failed sid=${payload.sid}: ${errorMessage(err)}`,
        );
      }
    }

    // Housekeeping only — a failure here must not fail the logout.
    try {
      await this.revoked.delete({ expiresAt: LessThan(new Date(now)) });
    } catch (err) {
      this.logger.warn(
        `expired revoked_sessions cleanup failed: ${errorMessage(err)}`,
      );
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
