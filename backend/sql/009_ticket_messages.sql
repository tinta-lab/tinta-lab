-- Adds the ticket_messages table — the conversation thread on a ticket
-- (client messages + staff replies + staff-only internal notes), replacing
-- the single free-text tickets.internalNotes column as the place new
-- back-and-forth gets recorded. internalNotes itself is untouched and keeps
-- displaying old rows; nothing here is a breaking change for it.
--
-- internal=false rows are the client-visible conversation; internal=true
-- rows are staff-only notes. Enforcement of that boundary lives in
-- application code (TicketsService.findByIdForClient filters internal =
-- false, and the CLIENT-facing DTO never accepts an `internal` field) —
-- this migration only adds the storage, not the boundary itself.
--
-- Safe to run more than once (idempotent). Must be applied BEFORE deploying
-- the updated backend, since production runs with TypeORM `synchronize: false`
-- and won't create these automatically.
--
-- Apply with:
--   docker exec -i tinta-postgres psql -U tinta -d tinta_lab < 009_ticket_messages.sql

BEGIN;

DO $$ BEGIN
  CREATE TYPE ticket_messages_authorrole_enum AS ENUM
    ('admin', 'support', 'sales', 'client');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS ticket_messages (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "ticketId"   uuid NOT NULL,
  "authorId"   uuid NOT NULL,
  "authorRole" ticket_messages_authorrole_enum NOT NULL,
  message      text NOT NULL,
  internal     boolean NOT NULL DEFAULT false,
  "createdAt"  timestamp NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE ticket_messages
    ADD CONSTRAINT "FK_ticket_messages_ticket" FOREIGN KEY ("ticketId") REFERENCES tickets(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ticket_messages
    ADD CONSTRAINT "FK_ticket_messages_author" FOREIGN KEY ("authorId") REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ticketId is queried directly (findByIdForClient's message list, the
-- future staff thread view) — see 005_access_logs_fk_indexes.sql for why
-- FK columns need an explicit index on Postgres.
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages("ticketId");

COMMIT;
