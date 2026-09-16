-- Indexes needed by the new Access Logs browser (AccessService.queryAuditEvents
-- / getAccessLogDetail, GET /access/logs, GET /access/sessions/:accessLogId):
--
--   - access_logs.ticketId    — filtered directly (?ticketId=) and joined
--                               from audit_events on every query
--   - access_logs.grantedById — filterable dimension (who opened the session)
--   - audit_events.actorUserId — filtered directly (?staffId=) and is the
--                               STAFF ticket-scope join's other endpoint
--   - ticket_messages.authorId — the STAFF scope subquery
--                               (SELECT DISTINCT ticketId ... WHERE authorId = ?)
--   - audit_events.createdAt / access_logs.createdAt — date-range filters
--     (?dateFrom=/?dateTo=)
--
-- access_logs.accessedById and ticket_messages.ticketId already have indexes
-- (005_access_logs_fk_indexes.sql, 009_ticket_messages.sql) — not repeated here.
--
-- Safe to run more than once. Must be applied BEFORE deploying the updated
-- backend, since production runs with TypeORM `synchronize: false`.
--
-- Apply with:
--   docker exec -i tinta-postgres psql -U tinta -d tinta_lab < 010_access_logs_browser_indexes.sql

CREATE INDEX IF NOT EXISTS idx_access_logs_ticket ON access_logs("ticketId");
CREATE INDEX IF NOT EXISTS idx_access_logs_granted_by ON access_logs("grantedById");
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs("createdAt");

CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events("actorUserId");
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events("createdAt");

CREATE INDEX IF NOT EXISTS idx_ticket_messages_author ON ticket_messages("authorId");
