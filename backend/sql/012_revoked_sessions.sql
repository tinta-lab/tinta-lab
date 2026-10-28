-- Session revocation in Postgres — replaces the Redis token blacklist.
--
-- Every login now mints a session id (the `sid` JWT claim, a uuid) that the
-- sliding session carries into each token it re-issues. Logout records that
-- sid here, and JwtStrategy and the /servers WS gateway reject every token of
-- the session — not just the one presented at logout, which is all the old
-- per-(user, iat) blacklist could revoke while the sliding session kept
-- minting new ones.
--
-- Why not Redis: the blacklist check failed OPEN when Redis was unreachable —
-- each request hung ~10s, then a revoked token was accepted and the sliding
-- session turned it into a fresh, un-revoked one. Every authenticated request
-- already reads users from Postgres, so this adds no dependency, and a DB
-- error now fails closed (503).
--
-- A row only has to outlive the newest token the session can still hold:
-- logout time + token TTL. "expiresAt" records that bound; rows past it are
-- deleted on the next revocation.
--
-- Apply BEFORE deploying the code that reads it — with the table missing,
-- every authenticated request would fail closed (503).

BEGIN;

CREATE TABLE IF NOT EXISTS revoked_sessions (
    "sessionId"  uuid        PRIMARY KEY,
    "userId"     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "revokedAt"  timestamptz NOT NULL DEFAULT now(),
    "expiresAt"  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_revoked_sessions_expiresAt"
    ON revoked_sessions ("expiresAt");

COMMIT;
