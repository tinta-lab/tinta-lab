-- Adds the SECURITY_ANOMALY value to the audit_events eventType enum, needed
-- by the support-access auth audit (agent diffs HA's user list before/after
-- each support session and reports anything unexpected — see
-- tinta_agent/src/ha-security-audit.ts and
-- backend/src/tinta-core/tinta-agent.gateway.ts `security_alert` handler).
--
-- Safe to run more than once. Must be applied BEFORE deploying the updated
-- backend, since production runs with TypeORM `synchronize: false`.
--
-- Apply with:
--   docker exec -i tinta-postgres psql -U tinta -d tinta_lab < 004_security_anomaly_event_type.sql
--
-- Note: ALTER TYPE ... ADD VALUE cannot be combined with USE of that value in
-- the same transaction, so this intentionally does not wrap in BEGIN/COMMIT.

ALTER TYPE audit_events_eventtype_enum ADD VALUE IF NOT EXISTS 'security_anomaly';
