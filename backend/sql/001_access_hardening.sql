-- Schema changes required by the access-session hardening pass:
--   - ticket/reason binding + retention hold on access_logs
--   - append-only, hash-chained audit_events ledger
--
-- Safe to run more than once (idempotent). Must be applied BEFORE deploying
-- the updated backend, since production runs with TypeORM `synchronize: false`
-- and won't create these automatically.
--
-- Apply with:
--   docker exec -i tinta-postgres psql -U tinta -d tinta_lab < 001_access_hardening.sql

BEGIN;

-- ── access_logs: reason / ticket link / retention hold ──────────────────────

ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS reason text;

ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS "ticketId" uuid;
DO $$ BEGIN
  ALTER TABLE access_logs
    ADD CONSTRAINT "FK_access_logs_ticket" FOREIGN KEY ("ticketId") REFERENCES tickets(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS "retentionHold" boolean NOT NULL DEFAULT false;

-- ── audit_events: append-only hash-chained ledger ────────────────────────────

DO $$ BEGIN
  CREATE TYPE audit_events_eventtype_enum AS ENUM
    ('granted', 'connected', 'activity_log', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE SEQUENCE IF NOT EXISTS audit_events_seq_seq;

CREATE TABLE IF NOT EXISTS audit_events (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  seq           bigint NOT NULL DEFAULT nextval('audit_events_seq_seq'),
  "accessLogId" uuid NOT NULL,
  "eventType"   audit_events_eventtype_enum NOT NULL,
  "actorUserId" uuid,
  metadata      jsonb,
  "createdAt"   timestamp NOT NULL DEFAULT now(),
  "prevHash"    varchar(64),
  hash          varchar(64) NOT NULL
);

ALTER SEQUENCE audit_events_seq_seq OWNED BY audit_events.seq;

CREATE INDEX IF NOT EXISTS idx_audit_events_seq ON audit_events (seq);
CREATE INDEX IF NOT EXISTS idx_audit_events_access_log_id ON audit_events ("accessLogId");

-- Insert-only enforcement: even an admin with full app-DB credentials cannot
-- silently edit or remove a ledger row through the normal SQL path.
CREATE OR REPLACE FUNCTION audit_events_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_events_no_update ON audit_events;
CREATE TRIGGER trg_audit_events_no_update
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_block_mutation();

COMMIT;
