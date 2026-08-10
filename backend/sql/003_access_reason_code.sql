-- GDPR hardening: replaces the free-text access_logs.reason going forward
-- with a closed enum (reasonCode) plus an optional, validated free-text
-- field (reasonDetails) that's only ever populated when reasonCode='other'.
--
-- The old `reason` column and any historical values in it (including
-- whatever free text already made it into the append-only audit_events
-- ledger) are left untouched — this migration is additive only, matching
-- the append-only philosophy: we can't rewrite history, only change what
-- gets written going forward.
--
-- Values in the CHECK constraint must be kept in sync by hand with
-- backend/src/access/enums/access-reason.enum.ts. Adding a new enum value
-- requires a follow-up migration to widen this constraint; removing one
-- is not safe once rows exist with it.
--
-- Safe to run more than once (idempotent). Must be applied BEFORE deploying
-- the updated backend, since production runs with TypeORM `synchronize: false`
-- and won't create these automatically.
--
-- Apply with:
--   docker exec -i tinta-postgres psql -U tinta -d tinta_lab < 003_access_reason_code.sql

BEGIN;

ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS "reasonCode" varchar(32);
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS "reasonDetails" varchar(280);

DO $$ BEGIN
  ALTER TABLE access_logs ADD CONSTRAINT chk_access_logs_reason_code
    CHECK (
      "reasonCode" IS NULL
      OR "reasonCode" IN (
        'general_question',
        'device_not_working',
        'automation_help',
        'connectivity_issue',
        'other',
        'ha_dashboard_toggle'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
