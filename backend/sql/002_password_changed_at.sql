-- Adds users.passwordChangedAt, used by JwtStrategy to reject any JWT issued
-- before the user's last password change (self-service or admin reset) —
-- closes the window where a leaked/stolen token outlives a password reset.
--
-- Safe to run more than once (idempotent). Must be applied BEFORE deploying
-- the updated backend, since production runs with TypeORM `synchronize: false`
-- and won't create this column automatically.
--
-- Apply with:
--   docker exec -i tinta-postgres psql -U tinta -d tinta_lab < 002_password_changed_at.sql

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS "passwordChangedAt" timestamptz;

COMMIT;
