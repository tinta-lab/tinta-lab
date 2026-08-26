-- Adds servers.publicStatus / publicCheckedAt — tracks whether the client's
-- Cloudflare Tunnel hostname actually responds, independently of
-- servers.status (agent<->Tinta Core WebSocket link). The runbook already
-- documents these as two unrelated mechanisms that can disagree (agent
-- "online" while the public URL returns 502/1033); this gives the client
-- dashboard a second, real signal instead of implying tunnel health from
-- agent heartbeat. Populated by ServersService.checkPublicReachability(),
-- run on a cron in servers/servers-public-status.scheduler.ts.
--
-- Safe to run more than once (idempotent). Must be applied BEFORE deploying
-- the updated backend, since production runs with TypeORM `synchronize: false`
-- and won't create these automatically.
--
-- Apply with:
--   docker exec -i tinta-postgres psql -U tinta -d tinta_lab < 006_server_public_status.sql

BEGIN;

DO $$ BEGIN
  CREATE TYPE servers_publicstatus_enum AS ENUM ('reachable', 'unreachable', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS "publicStatus" servers_publicstatus_enum NOT NULL DEFAULT 'unknown';

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS "publicCheckedAt" timestamp;

COMMIT;
