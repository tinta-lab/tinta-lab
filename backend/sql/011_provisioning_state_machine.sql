-- Phase 1.4 provisioning reliability — schema for PHASE1_4_PROVISIONING_SPEC.md
-- v2.5 (§3, §6.1, §3.3, §13, §20). This migration only. No application code
-- (ProvisioningService/ProvisioningController/entities) changes accompany
-- this commit — those land in later Phase 1.4 steps, once this schema
-- exists for them to target.
--
-- Three additions:
--   1. agent_sessions."provisioningState" — the 4-value ProvisioningState
--      enum (§3.1). Only ever meaningful once an AgentSession row exists,
--      which is already true for every row this backfill touches.
--   2. provisioning_operations — new table, the ProvisioningOperation
--      persistence model (§6.1): one row per provisionClient() execution
--      attempt, carrying the atomic idempotency claim (§5.4) and the
--      lastCompletedStep recovery cursor (§6.1-§6.2).
--   3. servers."cloudflareProvisioningStatus" / "cloudflareFailureCode" —
--      Resource/Health evidence (§3.3), independent of ProvisioningState
--      per §3.0's hard rule.
--
-- Naming: table/column casing follows this codebase's existing convention
-- (snake_case table names, quoted camelCase columns — see
-- 006_server_public_status.sql, 009_ticket_messages.sql) rather than the
-- spec's illustrative snake_case SQL in §5.4, which was pseudocode pending
-- exactly this reconciliation against the real schema. Enum *values* follow
-- the existing lowercase-string convention (AgentStatus, ServerStatus,
-- ServerPublicStatus, AuditEventType, ticket_messages."authorRole" are all
-- lowercase strings under upper-case TS enum keys) rather than the spec's
-- upper-case pseudocode (AWAITING_INSTALL etc.) — the TS enums added in a
-- later step will map e.g. `AWAITING_INSTALL = 'awaiting_install'`, exactly
-- as `AgentStatus.CONNECTED = 'connected'` already does today.
--
-- provisioning_operations.id is this table's primary key, realizing the
-- spec's "operationId" concept — every other table in this schema names its
-- PK `id` (see ticket_messages, audit_events, agent_sessions, servers),
-- and this table follows that convention rather than literally naming the
-- column `operationId`.
--
-- Backfill safety: agent_sessions."provisioningState" is recomputed from
-- columns (lastConnectedAt/installTokenExpiresAt/serviceStartConsentAt)
-- that remain the source of truth going forward too (checkProvisioning
-- already derives from them, §19), so recomputing is safe by construction
-- even if this migration were mistakenly re-run later. servers.
-- "cloudflareProvisioningStatus" does NOT have that property once §7's
-- reconciliation cron starts writing specific failure codes no longer
-- inferable from column nullness alone — so both backfills are additionally
-- guarded with `WHERE ... IS NULL`, making them strictly one-time regardless.
--
-- Safe to run more than once (idempotent). Must be applied BEFORE deploying
-- the updated backend, since production runs with TypeORM `synchronize: false`
-- and won't create these automatically.
--
-- Apply with:
--   docker exec -i tinta-postgres psql -U tinta -d tinta_lab < 011_provisioning_state_machine.sql

BEGIN;

-- ── 1. agent_sessions.provisioningState (§3.1) ──────────────────────────────

DO $$ BEGIN
  CREATE TYPE agent_sessions_provisioningstate_enum AS ENUM
    ('awaiting_install', 'install_consented', 'install_expired', 'ready');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE agent_sessions
  ADD COLUMN IF NOT EXISTS "provisioningState" agent_sessions_provisioningstate_enum;

-- §20's exact priority order: lastConnectedAt beats everything (READY is
-- reached and never un-reached), then expiry, then consent, else the
-- fresh-AgentSession default. Guarded to run once — see header note.
UPDATE agent_sessions SET "provisioningState" = (
  CASE
    WHEN "lastConnectedAt" IS NOT NULL THEN 'ready'
    WHEN "installTokenExpiresAt" IS NOT NULL AND "installTokenExpiresAt" < now() THEN 'install_expired'
    WHEN "serviceStartConsentAt" IS NOT NULL THEN 'install_consented'
    ELSE 'awaiting_install'
  END
)::agent_sessions_provisioningstate_enum
WHERE "provisioningState" IS NULL;

ALTER TABLE agent_sessions
  ALTER COLUMN "provisioningState" SET DEFAULT 'awaiting_install',
  ALTER COLUMN "provisioningState" SET NOT NULL;

-- ── 2. provisioning_operations (§6.1) ────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE provisioning_operations_status_enum AS ENUM
    ('in_progress', 'succeeded', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE provisioning_operations_lastcompletedstep_enum AS ENUM
    ('resolve_client', 'ensure_server', 'reconcile_cloudflare',
     'ensure_agent_session', 'prepare_install', 'complete');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS provisioning_operations (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "clientId"          uuid,
  "serverId"          uuid,
  "idempotencyKey"    varchar(255),
  "principalUserId"   uuid NOT NULL,
  "requestFingerprint" varchar(64) NOT NULL,
  status              provisioning_operations_status_enum NOT NULL DEFAULT 'in_progress',
  "lastCompletedStep" provisioning_operations_lastcompletedstep_enum,
  "createdAt"         timestamp NOT NULL DEFAULT now(),
  "updatedAt"         timestamp NOT NULL DEFAULT now(),
  "completedAt"       timestamp,
  -- Freeform per §16 rather than a native enum/CHECK — the failure-reason
  -- set is expected to grow (§16 itself is marked PROPOSED) and, unlike
  -- access_logs.reasonCode (GDPR-sensitive, deliberately closed), nothing
  -- here needs a hard DB-level guarantee against unlisted values.
  "failureCode"       varchar(64),
  "failureMessage"    text,
  "cachedResult"      jsonb
);

DO $$ BEGIN
  ALTER TABLE provisioning_operations
    ADD CONSTRAINT "FK_provisioning_operations_client" FOREIGN KEY ("clientId") REFERENCES clients(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE provisioning_operations
    ADD CONSTRAINT "FK_provisioning_operations_server" FOREIGN KEY ("serverId") REFERENCES servers(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE provisioning_operations
    ADD CONSTRAINT "FK_provisioning_operations_principal" FOREIGN KEY ("principalUserId") REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- The §5.4 atomic claim itself — the load-bearing constraint of the whole
-- idempotency model. Partial (WHERE "idempotencyKey" IS NOT NULL) per §5.4:
-- ordinary Postgres UNIQUE already permits multiple NULLs, but a partial
-- index states that intent explicitly rather than leaving it incidental.
CREATE UNIQUE INDEX IF NOT EXISTS idx_provisioning_operations_principal_key
  ON provisioning_operations ("principalUserId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

-- FK columns need an explicit index on Postgres (no MySQL-style auto-index
-- on FK columns) — see 005_access_logs_fk_indexes.sql. clientId is the
-- lookup §6.2's step-resumability logic and §14's reconciliation use.
CREATE INDEX IF NOT EXISTS idx_provisioning_operations_client
  ON provisioning_operations ("clientId");

CREATE INDEX IF NOT EXISTS idx_provisioning_operations_server
  ON provisioning_operations ("serverId");

-- Serves §14's "ProvisioningOperation stuck IN_PROGRESS with updatedAt
-- older than a threshold" reconciliation query directly, without a table
-- scan once this table has real volume.
CREATE INDEX IF NOT EXISTS idx_provisioning_operations_in_progress
  ON provisioning_operations ("updatedAt")
  WHERE status = 'in_progress';

-- ── 3. servers Resource/Health evidence (§3.3) ───────────────────────────────

DO $$ BEGIN
  CREATE TYPE servers_cloudflareprovisioningstatus_enum AS ENUM
    ('pending', 'provisioned', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS "cloudflareProvisioningStatus" servers_cloudflareprovisioningstatus_enum;

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS "cloudflareFailureCode" varchar(64);

-- §20's exact backfill rule: PROVISIONED requires the complete resource set
-- (tunnel + token + DNS record) confirmed present, not any single column's
-- non-nullness; a present tunnelId with an incomplete set gets a distinct
-- HISTORICAL_INCOMPLETE code rather than being conflated with a freshly
-- observed, more specific failure. Guarded to run once — see header note.
UPDATE servers SET
  "cloudflareProvisioningStatus" = (
    CASE
      WHEN "tunnelId" IS NOT NULL AND "tunnelToken" IS NOT NULL AND "cfDnsRecordId" IS NOT NULL
        THEN 'provisioned'
      WHEN "tunnelId" IS NOT NULL
        THEN 'failed'
      ELSE 'pending'
    END
  )::servers_cloudflareprovisioningstatus_enum,
  "cloudflareFailureCode" = (
    CASE
      WHEN "tunnelId" IS NOT NULL AND ("tunnelToken" IS NULL OR "cfDnsRecordId" IS NULL)
        THEN 'HISTORICAL_INCOMPLETE'
      ELSE NULL
    END
  )
WHERE "cloudflareProvisioningStatus" IS NULL;

ALTER TABLE servers
  ALTER COLUMN "cloudflareProvisioningStatus" SET DEFAULT 'pending',
  ALTER COLUMN "cloudflareProvisioningStatus" SET NOT NULL;

-- ── 4. clients.isInstalled backfill (§13, §20) ───────────────────────────────

-- Derived compatibility projection (§13) — one-directional, never resets an
-- already-true row, safe to re-run: the join condition (lastConnectedAt IS
-- NOT NULL) is itself permanent once true, per §3.1's READY monotonicity.
UPDATE clients c SET "isInstalled" = true
FROM agent_sessions a
WHERE a."clientId" = c.id
  AND a."lastConnectedAt" IS NOT NULL
  AND c."isInstalled" = false;

COMMIT;
