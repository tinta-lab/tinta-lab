-- access_logs.serverId and access_logs.accessedById are queried directly
-- (findStaffActivity's raw `WHERE al."accessedById" = ANY($1)`, and every
-- getLogsForServer/getActiveAccessForServer lookup filters on serverId) but
-- neither had an index — Postgres does NOT auto-index foreign key columns
-- the way MySQL does, so both were full table scans. Harmless at today's
-- row count, not harmless forever.
--
-- Safe to run more than once. Must be applied BEFORE deploying the updated
-- backend, since production runs with TypeORM `synchronize: false`.
--
-- Apply with:
--   docker exec -i tinta-postgres psql -U tinta -d tinta_lab < 005_access_logs_fk_indexes.sql

CREATE INDEX IF NOT EXISTS idx_access_logs_server ON access_logs("serverId");
CREATE INDEX IF NOT EXISTS idx_access_logs_accessed_by ON access_logs("accessedById");
