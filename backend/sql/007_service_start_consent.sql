-- Adds agent_sessions.serviceStartConsentAt — records when a client
-- explicitly consented to Tinta Lab starting service execution before the
-- statutory 14-day withdrawal period ends (§ 356 Abs. 4 BGB). Without this
-- durable, server-set timestamp, a client could use the service for 13 days
-- and still withdraw for a full refund, since the acknowledgment can't be
-- proven after the fact. Set by ProvisioningService.confirmInstallConsent(),
-- called from POST /install/:token/consent before GET /install/:token will
-- reveal the agent token or install steps — see install.controller.ts.
--
-- Safe to run more than once (idempotent). Must be applied BEFORE deploying
-- the updated backend, since production runs with TypeORM `synchronize: false`
-- and won't create this column automatically.
--
-- Apply with:
--   docker exec -i tinta-postgres psql -U tinta -d tinta_lab < 007_service_start_consent.sql

BEGIN;

ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS "serviceStartConsentAt" timestamp;

COMMIT;
