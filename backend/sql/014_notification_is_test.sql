-- Test notifications, kept out of the delivery metrics.
--
-- A deliberate test (pipeline check after a deploy, token rotation, ...) is a
-- real Telegram delivery, but counting it would skew the Grafana panels —
-- one test send after a quiet week reads as "100% success". "isTest" marks
-- such rows; the dashboard excludes them and shows them separately. The
-- dispatcher copies the flag onto each attempt row. Test messages are
-- prefixed "🧪 ТЕСТ" in Telegram.

BEGIN;

ALTER TABLE notification_outbox
    ADD COLUMN IF NOT EXISTS "isTest" boolean NOT NULL DEFAULT false;
ALTER TABLE notification_attempts
    ADD COLUMN IF NOT EXISTS "isTest" boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafana_ro') THEN
    GRANT SELECT ("isTest") ON notification_outbox TO grafana_ro;
    GRANT SELECT ("isTest") ON notification_attempts TO grafana_ro;
  END IF;
END
$$;

COMMIT;
