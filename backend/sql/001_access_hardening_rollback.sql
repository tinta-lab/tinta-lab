-- Rollback for 001_access_hardening.sql.
--
-- SAFE to run only if the migration was just applied and no real audit events
-- have been recorded yet (i.e. rolling back an aborted deploy). If audit_events
-- already holds real session history, dropping it destroys that history —
-- rename/archive the table instead of dropping it in that case:
--   ALTER TABLE audit_events RENAME TO audit_events_archived_<date>;
--
-- Apply with:
--   docker exec -i tinta-postgres psql -U tinta -d tinta_lab < 001_access_hardening_rollback.sql

BEGIN;

DROP TRIGGER IF EXISTS trg_audit_events_no_update ON audit_events;
DROP FUNCTION IF EXISTS audit_events_block_mutation();
DROP TABLE IF EXISTS audit_events;
DROP SEQUENCE IF EXISTS audit_events_seq_seq;
DROP TYPE IF EXISTS audit_events_eventtype_enum;

ALTER TABLE access_logs DROP CONSTRAINT IF EXISTS "FK_access_logs_ticket";
ALTER TABLE access_logs DROP COLUMN IF EXISTS "ticketId";
ALTER TABLE access_logs DROP COLUMN IF EXISTS reason;
ALTER TABLE access_logs DROP COLUMN IF EXISTS "retentionHold";

COMMIT;
