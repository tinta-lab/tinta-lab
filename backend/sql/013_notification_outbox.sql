-- Transactional outbox for Telegram notifications.
--
-- notification_outbox: one row per notification to deliver. A security
-- anomaly's row is inserted in the SAME transaction as its audit_events row
-- (AuditLogService.append's inTransaction hook), so once that commits, the
-- alert is durably queued — a PM2 restart or a Telegram outage only delays
-- it. NotificationDispatcher claims due rows with FOR UPDATE SKIP LOCKED,
-- leases them via "lockedUntil" (a crashed send is reclaimed after the lease
-- expires), and retries with a per-priority backoff until "maxAttempts",
-- then leaves the row as 'failed' for diagnosis.
--
-- notification_attempts: one row per delivery attempt (sent / retry /
-- failed). Status in the outbox only says where a notification is now; the
-- attempt log is what the Grafana panels chart over time.
--
-- Delivery is at-least-once: if Telegram accepted a message but the result
-- wasn't recorded (crash, timeout), it is sent again. Messages carry the
-- short outbox id so a duplicate is recognisable.
--
-- priority: 0 critical (security), 1 high (technical), 2 normal
-- (provisioning), 3 low (informational) — see notification-policy.ts.

BEGIN;

CREATE TABLE IF NOT EXISTS notification_outbox (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    "eventType"      varchar(64) NOT NULL,
    priority         smallint    NOT NULL,
    payload          jsonb       NOT NULL,
    status           varchar(16) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
    attempts         integer     NOT NULL DEFAULT 0,
    "maxAttempts"    integer     NOT NULL,
    "createdAt"      timestamptz NOT NULL DEFAULT now(),
    "nextAttemptAt"  timestamptz NOT NULL DEFAULT now(),
    "lockedUntil"    timestamptz,
    "sentAt"         timestamptz,
    "lastErrorCode"  varchar(64)
);

-- The dispatcher's claim query: due work, most urgent first.
CREATE INDEX IF NOT EXISTS "IDX_notification_outbox_due"
    ON notification_outbox (priority, "nextAttemptAt")
    WHERE status IN ('pending', 'processing');

CREATE TABLE IF NOT EXISTS notification_attempts (
    id               bigserial   PRIMARY KEY,
    "notificationId" uuid        NOT NULL REFERENCES notification_outbox(id) ON DELETE CASCADE,
    "eventType"      varchar(64) NOT NULL,
    "attemptedAt"    timestamptz NOT NULL DEFAULT now(),
    outcome          varchar(16) NOT NULL CHECK (outcome IN ('sent', 'retry', 'failed')),
    "httpAttempts"   integer     NOT NULL,
    "errorCode"      varchar(64),
    "durationMs"     integer     NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_notification_attempts_attemptedAt"
    ON notification_attempts ("attemptedAt");
CREATE INDEX IF NOT EXISTS "IDX_notification_attempts_notificationId"
    ON notification_attempts ("notificationId");

-- Grafana's read-only role: counts, timings and error codes only — never
-- payload (client names, HA usernames).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafana_ro') THEN
    GRANT SELECT (id, "eventType", priority, status, attempts, "maxAttempts",
                  "createdAt", "nextAttemptAt", "lockedUntil", "sentAt", "lastErrorCode")
      ON notification_outbox TO grafana_ro;
    GRANT SELECT ("eventType", "attemptedAt", outcome, "httpAttempts", "errorCode", "durationMs")
      ON notification_attempts TO grafana_ro;
  END IF;
END
$$;

COMMIT;
