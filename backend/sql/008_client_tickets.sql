-- Adds tickets.clientId / tickets.serverId — links a support ticket to the
-- authenticated client and the home/server it concerns. Both nullable:
-- tickets created via the public contact form (POST /tickets/public) have
-- no authenticated client and no server context, so those existing rows
-- (and any new anonymous-lead rows) keep them null. The upcoming
-- client-portal ticket flow (POST /tickets, authenticated CLIENT role)
-- will set both.
--
-- Safe to run more than once (idempotent). Must be applied BEFORE deploying
-- the updated backend, since production runs with TypeORM `synchronize: false`
-- and won't create these automatically.
--
-- Apply with:
--   docker exec -i tinta-postgres psql -U tinta -d tinta_lab < 008_client_tickets.sql

BEGIN;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS "clientId" uuid;
DO $$ BEGIN
  ALTER TABLE tickets
    ADD CONSTRAINT "FK_tickets_client" FOREIGN KEY ("clientId") REFERENCES clients(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS "serverId" uuid;
DO $$ BEGIN
  ALTER TABLE tickets
    ADD CONSTRAINT "FK_tickets_server" FOREIGN KEY ("serverId") REFERENCES servers(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- tickets.clientId will be queried directly (findAllForClient / findByIdForClient
-- WHERE "clientId" = ...), same access pattern as access_logs.serverId —
-- see 005_access_logs_fk_indexes.sql for why FK columns need an explicit
-- index on Postgres (no MySQL-style auto-index on FK columns).
CREATE INDEX IF NOT EXISTS idx_tickets_client ON tickets("clientId");
CREATE INDEX IF NOT EXISTS idx_tickets_server ON tickets("serverId");

COMMIT;
