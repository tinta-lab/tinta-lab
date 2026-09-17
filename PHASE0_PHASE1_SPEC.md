# Tinta Lab — Phase 0 / Phase 1 Implementation Spec

Scope: Phase 0 items 1–3, Phase 1 items 1–6, exactly as enumerated below. No CRM, billing,
granular RBAC migration, or auto-incident automation — those are Phase 2+ and are only
mentioned here where a Phase 1 decision has a load-bearing consequence for them.

All facts below were re-verified against the actual repo at `/home/tinta/tinta-lab` (backend
NestJS 11 / TypeORM 0.3 / Postgres, frontend Next.js) and `/home/tinta/tinta-agent-pub/tinta_agent`
on 2026-09-11. Corrections to the prior-investigation brief are called out inline as **CORRECTION**.

---

## 0. Corrections to the prior-investigation brief

These materially change the shape of the work below — read before implementing:

1. **`GET /tickets` is not staff-blind by role today.** It's already `@Roles(ADMIN, SALES, SUPPORT)`
   in `backend/src/tickets/tickets.controller.ts:155-173` and already strips `Server` infra
   secrets for non-ADMIN via `toSupportServerView`. What's actually missing is a `clientId`
   query filter (Phase 0 item 2 is accurate on this point) — the *role* gate was already correct.
2. **`GET /access/logs` and `GET /access/sessions/:accessLogId` are already staff-facing**, not
   ADMIN-only. `access.controller.ts:98-125` already implements exactly the "ADMIN global +
   SUPPORT/SALES ticket-scoped" model, and the *frontend already consumes it*: there is a working
   `/dashboard/admin/access-logs` page (`frontend/src/app/dashboard/admin/access-logs/page.tsx`)
   wired to `AccessLogList` → `accessApi.getAccessLogs()` → `GET /access/logs`. Only
   `GET /access/audit-verify` and `GET /access/audit/:accessLogId` (the hash-chain endpoints) are
   genuinely ADMIN-only and genuinely unused by any frontend page — confirmed by grep, nothing
   references `/access/audit-verify` or `/access/audit/` anywhere under `frontend/src`.
3. **There is a whole `ticket_messages` subsystem** (`backend/src/tickets/entities/ticket-message.entity.ts`,
   migration `009_ticket_messages.sql`) that the prior brief never mentioned: staff replies,
   client replies, and staff-only internal notes, each with `authorId`/`authorRole`/`internal`.
   This is directly relevant to Phase 0 item 1's "audit event on status change" requirement (see
   §Phase 0.1) and to Phase 1 item 6's "audit trail entry" requirement (see §Phase 1.6) — both
   should reuse this table rather than inventing a new one.
4. **`/dashboard/support` is not a flat grid of all servers.** It fetches all servers but renders
   only `servers.filter(s => s.accessEnabled)` — i.e. it's already "sessions I currently have open",
   not "every server". It also already has a nav card linking to `/dashboard/support/tickets`. The
   "ticket-first" ask in Phase 1 item 1 is about *default landing content*, not building ticket
   navigation from scratch.
5. **There are two parallel staff ticket UIs**, not one: `/dashboard/support/tickets` +
   `/dashboard/support/tickets/[id]` (role-gated ADMIN/SALES/SUPPORT via
   `StaffTicketsLayout`, `canEditStatus = role === 'admin' || role === 'sales'` at
   `[id]/page.tsx:46`), **and** a separate, ADMIN-only `/dashboard/admin/tickets` page with its own
   inline status editor that calls `PATCH /tickets/:id/status` directly (not through
   `staffTicketsApi`). Phase 0 item 1 must fix the permission check in the first UI and confirm the
   second is unaffected (it's ADMIN-gated at the page level, so SUPPORT can never reach it).
6. **The `Hub` aggregation (`GET /hubs`, ADMIN-only) and the diagnostics live-check
   (`GET /tinta-core/diagnostics/:clientId`, also ADMIN-only) are two different data sources that
   currently feed the *same* HubDrawer UI without being reconciled**: the CPU/RAM/Disk bars shown
   in `HubDrawer` (`frontend/src/app/dashboard/admin/hubs/page.tsx:628-638`) come from the *stale*
   `AgentSession.metrics` jsonb snapshot pushed periodically over the `metrics` WS event, while the
   "live diagnostics" call (`checkDiagnostics`, same file, lines 389-397) only ever reads
   `diag.report.haConnected` for a badge — its own live `cpuPercent`/`memPercent`/`diskPercent`
   fields are fetched and discarded. Phase 1 item 3 should resolve this, not just relocate it.
7. **`Server.publicStatus`/`publicCheckedAt` are already returned to SUPPORT today** — they're in
   `toSupportServerView` (`backend/src/servers/dto/support-server-view.dto.ts:25-26`) and already
   rendered on the **client** dashboard (`PublicStatusBadge` in
   `frontend/src/app/dashboard/client/page.tsx:46`). They are *not* in the `Hub` interface used by
   the admin Hubs page (`frontend/src/app/dashboard/admin/hubs/page.tsx:50-71`, backend counterpart
   `backend/src/hubs/hubs.service.ts:9-41`) — that's the actual gap for Phase 1 item 3, and the
   fix is small (two fields, both sides) because the underlying data already exists everywhere else.
8. **Client entity → the task's suggested route `GET /customers/:id/360` doesn't match this
   codebase.** There is no "customer" concept anywhere — entity, module, controller, and route are
   all named `Client`/`clients` consistently (`ClientsModule`, `ClientsController`,
   `@Controller('clients')`). The correct path is `GET /clients/:id/360`.
9. **Provisioning already has "attach to existing client" support and both a wizard and a script
   that call the same endpoint** — the "reconcile UI wizard vs. script" ask in Phase 1 item 4 is
   already solved architecturally (`scripts/provision-client.sh` is a thin curl/jq client of
   `POST /provisioning/client`, same as the wizard). What actually needs auditing is real gaps found
   during this pass — see §Phase 1.4, in particular a genuine bug where re-provisioning a second
   server for an existing client silently invalidates that client's already-connected agent session.

---

## Dependency ordering

```
Phase 0.3 (permission contract)
   └─▶ referenced by every Phase 1 backend change below (naming, not blocking — Phase 1 can
       start before 0.3 lands, but should adopt its role-group constants as soon as they exist)

Phase 0.1 (SUPPORT ticket-status transitions)
   └─▶ Phase 1.1 (Support Center ticket-first view surfaces status changes)

Phase 0.2 (clientId filters on GET /tickets, GET /access/logs)
   └─▶ Phase 1.5 (Customer 360 aggregates tickets-by-client and access-logs-by-client — it
       literally calls the filtered service methods Phase 0.2 adds)
   └─▶ Phase 1.2 (Security Center's client-scoped browsing is more useful with this, optional)

Phase 1.5 (Customer 360)
   └─▶ Phase 1.6 (ticket linkage cleanup's "attach to client" picker UI is most naturally hosted
       as an action reachable from — or at least visually consistent with — the Customer 360 page;
       the backend endpoint itself has no hard dependency on 1.5 and could ship standalone)

Phase 1.3 (Diagnostics Center) has no hard dependency on any other item but shares the
`DIAGNOSTICS_ROLES` constant with Phase 0.3.

Phase 1.4 (Provisioning hardening) is independent of everything else — it's an audit pass over
existing code plus small, isolated fixes.
```

---

# PHASE 0

## Phase 0.1 — SUPPORT can change `Ticket.status`, via an explicit state machine, with an audit trail

### Goal
A SUPPORT-role user can move a ticket through its lifecycle (e.g. `new → in_progress →
resolved`) from the ticket detail page, the same way ADMIN/SALES already can — but only along
allowed transitions, and every change leaves a durable, staff-visible record of who changed what
and when.

### Backend changes

**File: `backend/src/tickets/entities/ticket.entity.ts`** — no changes. `TicketStatus` enum stays
`NEW | IN_PROGRESS | WAITING_CLIENT | RESOLVED | CLOSED` (lines 16-22).

**New file: `backend/src/tickets/ticket-status.transitions.ts`**
Exports:
```ts
export const ALLOWED_TICKET_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.NEW]:            [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
  [TicketStatus.IN_PROGRESS]:    [TicketStatus.WAITING_CLIENT, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  [TicketStatus.WAITING_CLIENT]: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  [TicketStatus.RESOLVED]:       [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS], // reopen
  [TicketStatus.CLOSED]:         [], // terminal — no transitions out via this endpoint
};

export function isAllowedTicketStatusTransition(from: TicketStatus, to: TicketStatus): boolean {
  return from === to || ALLOWED_TICKET_STATUS_TRANSITIONS[from].includes(to);
}
```
Design decisions to preserve:
- `from === to` (no-op) is always allowed and is a cheap no-op write. Rationale: `UpdateTicketStatusDto.status`
  is a required field, and the existing PATCH is also the only way to update `assignedToId`/`internalNotes` —
  rejecting same-status requests would break "assign to me without changing status." The frontend
  already disables the same-status button, so this only matters for direct API callers.
- The table is role-agnostic — ADMIN does not bypass it. This keeps the state machine simple and the
  audit trail meaningful (no "how did this go straight from NEW to CLOSED" question with no answer).
  If a business need for an ADMIN override ever appears, that's a one-line addition to check
  `actor.role === UserRole.ADMIN` before consulting the table — not spec'd here because nothing today
  requires it.
- Invalid transition → `BadRequestException` (409/400 boundary: use 400, matching the acceptance
  criteria language in the task — "PATCH from RESOLVED→NEW gets 400").

**File: `backend/src/tickets/dto/update-ticket-status.dto.ts`** — no field changes needed; existing
shape (`status: TicketStatus`, `assignedToId?: string`, `internalNotes?: string`) already covers this.

**File: `backend/src/tickets/tickets.service.ts`**
- `updateStatus(id, status, assignedToId?, internalNotes?)` (lines 72-83) gets two new required
  params: `actor: { id: string; role: UserRole }`. New signature:
  `updateStatus(id: string, status: TicketStatus, actor: { id: string; role: UserRole }, assignedToId?: string, internalNotes?: string): Promise<Ticket>`.
- Before writing the update: load the current ticket (`findById(id)` already exists), call
  `isAllowedTicketStatusTransition(ticket.status, status)`; throw `BadRequestException` with a
  message naming both statuses if false.
- After the DB update succeeds (and only if `status !== ticket.status` — don't write a note for a
  no-op), write an audit trail entry **as an internal `TicketMessage`**, not into the
  `audit_events` hash chain. Rationale (see §Corrections item 3 and the architectural note below):
  `audit_events.accessLogId` is a `NOT NULL uuid` FK to `access_logs` (`backend/src/access/entities/audit-event.entity.ts:38-39`)
  — that table is scoped to *support-session* lifecycle events (GRANTED/CONNECTED/REVOKED/EXPIRED/…),
  not general application events, and forcing a ticket-status change through it would mean either
  inventing a fake `access_logs` row (wrong) or relaxing a FK that's part of a tamper-evident ledger
  specifically to widen its meaning (disproportionate for Phase 0). The existing `ticket_messages`
  table with `internal: true` already *is* this codebase's "staff-only durable record attached to a
  ticket" mechanism (used today for internal notes) — reuse it:
  ```
  ticketMessagesRepository.create({
    ticket: { id },
    author: { id: actor.id },
    authorRole: actor.role,
    internal: true,
    message: `Status changed: ${oldStatus} → ${newStatus}`,
  })
  ```
  This message is already visible wherever staff-side ticket messages render (`findMessagesForStaff`,
  `GET /tickets/:id/messages`) with no further plumbing.
- Use the existing `TicketMessage` repository already injected into `TicketsService` (line 25-26) —
  no new repository/module import needed.

**File: `backend/src/tickets/tickets.controller.ts`**
- `updateStatus` (lines 190-200): add `@CurrentUser() user: AuthenticatedUser` param, pass
  `{ id: user.id, role: user.role }` as `actor` to the service call.
- Change `@Roles(UserRole.ADMIN, UserRole.SALES)` → `@Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SUPPORT)`
  (or, once Phase 0.3 lands, `@Roles(...TICKET_MANAGE_ROLES)` — see §Phase 0.3).
- **New requirement not in the original ask but necessary for correctness**: today `updateStatus`
  returns the raw `Ticket` entity unconditionally (no role-based stripping), unlike `findAll`/`findOne`
  in the same controller which strip `Server` infra secrets via `toSupportServerView` for everyone
  except ADMIN (lines 168-172, 183-187). Since SUPPORT can now call this route, apply the same
  stripping to the response: `user.role === ADMIN ? ticket : { ...ticket, server: ticket.server ? toSupportServerView(ticket.server) : null }`.

**Migration**: none. No schema change — `ticket_messages` and `tickets.status` already exist.

### Frontend changes

**File: `frontend/src/app/dashboard/support/tickets/[id]/page.tsx`**
- Line 46: `const canEditStatus = user?.role === 'admin' || user?.role === 'sales';` →
  `const canEditStatus = user?.role === 'admin' || user?.role === 'sales' || user?.role === 'support';`
  (or a shared helper — see §Phase 0.3 frontend convention).
- The status-transition buttons (lines 153-170, `STATUS_OPTIONS.map`) currently disable only the
  ticket's *current* status button. Update to also disable any button whose target status is not in
  `ALLOWED_TICKET_STATUS_TRANSITIONS[ticket.status]` (hand-mirror the backend map into a small
  frontend constant, e.g. `frontend/src/lib/ticketStatusTransitions.ts`, with a comment pointing at
  the backend source file — matches this codebase's existing manual-mirror convention already used
  for every type in `frontend/src/types/index.ts`). This avoids a round-trip 400 for a transition the
  UI could have already ruled out.
- `services/staffTicketsApi.ts` `updateStatus()` needs no signature change (still `(id, status, internalNotes?)`)
  — `actor` is derived server-side from the JWT, not sent by the client.

**File: `frontend/src/app/dashboard/admin/tickets/page.tsx`** — no change required. It's gated
`user.role !== 'admin'` at the page level (line 68), so SUPPORT can never reach it; its inline
status `<select>` (lines 260-272) has no separate role check to fix. Confirm during implementation
that its `handleSave` (line 99-109, direct `api.patch` call) still gets a 400 from the backend for
an invalid transition and surfaces `toast.error(t('error'))` — the existing catch block already
does this generically, no new code needed there.

### Acceptance criteria
- SUPPORT-role user: `PATCH /tickets/:id/status` with `{status: 'in_progress'}` on a ticket
  currently `new` → 200, ticket status updates, a new internal `TicketMessage` row exists for that
  ticket with `message` containing `"new → in_progress"` and `authorRole: 'support'`.
- Same user: `PATCH /tickets/:id/status` with `{status: 'new'}` on a ticket currently `resolved` →
  400, no `TicketMessage` written, ticket status unchanged.
- ADMIN and SALES: existing allowed transitions continue to return 200 exactly as before Phase 0.
- CLIENT role: `PATCH /tickets/:id/status` → 403 (unchanged, `RolesGuard` rejects before the
  handler runs — no CLIENT was ever in the allowed-roles list).
- `GET /tickets/:id/messages` (staff) after a status change includes the auto-generated internal
  note; `GET /tickets/mine/:id` (client) does **not** show it (already guaranteed by the existing
  `internal: false` filter in `findByIdForClient`, no new code needed to enforce this).
- `/dashboard/support/tickets/[id]` rendered as SUPPORT shows the status-transition buttons and
  they function; buttons for disallowed target statuses are disabled without a network call.

---

## Phase 0.2 — `clientId` filtering on `GET /tickets` and `GET /access/logs`

### Goal
Staff can filter the ticket list and the access-log/event browser down to one client's activity —
the building block Customer 360 (Phase 1.5) aggregates on top of.

### Backend changes

**File: `backend/src/tickets/tickets.controller.ts`**
- `findAll` (lines 155-173): add `@Query('clientId') clientId: string | undefined` param, pass
  through to `ticketsService.findAll(status, clientId, pagination.skip, pagination.take)`.

**File: `backend/src/tickets/tickets.service.ts`**
- `findAll(status?, skip?, take?)` (lines 45-61) → `findAll(status?: TicketStatus, clientId?: string, skip?: number, take?: number)`.
  Extend the `where` object: `const where: any = {}; if (status) where.status = status; if (clientId) where.client = { id: clientId };`.
  No index needed beyond what `sql/008_client_tickets.sql` already created (`idx_tickets_client`).

**File: `backend/src/access/dto/access-logs-query.dto.ts`**
- Add:
  ```ts
  @IsOptional()
  @IsUUID()
  clientId?: string;
  ```

**File: `backend/src/access/access.service.ts`**
- `queryAuditEvents` (lines 415-505): the SQL already `LEFT JOIN clients c ON c.id = s."clientId"`
  (line 454) for display purposes — add one more conditional filter alongside the existing ones
  (lines 426-431): `if (filter.clientId) push('c.id = ?', filter.clientId);`. No new join, no new
  index needed (`clients.id` is the PK).

**Migration**: none — both filters ride on existing columns/joins.

### Frontend changes

**File: `frontend/src/types/index.ts`**
- `AccessLogsFilters` interface (around line 146): add `clientId?: string;`.
- `staffTicketsApi.getAll` signature in `frontend/src/services/staffTicketsApi.ts` gains an optional
  second param: `getAll: (status?: TicketStatus, clientId?: string) => api.get<Ticket[]>('/tickets', { params: { status, clientId } })...`.

**File: `frontend/src/components/access/AccessLogFilters.tsx`** — optional, not required for
Phase 0 acceptance: could add a client `<select>` mirroring the existing server one (lines 84-96),
sourced from `api.get('/clients')`. Recommend deferring the UI control itself to Phase 1.5/1.6 where
it has an actual caller (Customer 360 and the ticket-linkage picker both need a client list fetch
already) — the backend filter existing and typed is what Phase 0 needs to unblock Phase 1.

### Acceptance criteria
- `GET /tickets?clientId=<X>` returns only tickets whose `client.id === X`, verified against seed
  data with at least two clients each having ≥1 ticket.
- `GET /tickets` (no `clientId`) behavior is byte-for-byte unchanged from before this change.
- `GET /access/logs?clientId=<X>` (as ADMIN) returns only events whose underlying `access_logs.server.client.id === X`.
- `GET /access/logs?clientId=<X>` (as SUPPORT) still applies the existing ticket-scope restriction
  *in addition to* the client filter (i.e. `clientId` narrows within their scope, it does not
  bypass it) — verify with a SUPPORT user who has ticket-scope access to client X's tickets but not
  client Y's: `?clientId=Y` returns an empty page, not a 403 (empty result is consistent with how
  `ticketId`/`serverId` filters already behave when they fall outside scope).

---

## Phase 0.3 — Permission-architecture contract (not a migration)

### Goal
Give Phase 1 a naming convention so new endpoints reference *named capability groups* instead of
raw `@Roles(UserRole.X, UserRole.Y, …)` lists, without touching any of the 45 existing call sites
or introducing a permissions table. If/when a real permissions system replaces `UserRole` later,
only this one file's exports change — call sites don't.

### Backend changes

**New file: `backend/src/auth/role-groups.ts`**
```ts
import { UserRole } from '../users/entities/user.entity';

// Named role groups for NEW endpoints (Phase 1 onward). Existing @Roles(...) call sites in
// access/tickets/servers/clients/users/tinta-core/provisioning/hubs/auth are intentionally left
// as raw enum lists — migrating them is out of scope for this pass and not required for Phase 1
// to be written cleanly. New code should import from here instead of writing new raw lists.
//
// If a granular permissions table replaces UserRole later, these exports are the only thing that
// needs to change — every @Roles(...GROUP) call site keeps compiling and keeps meaning the same
// thing without being touched.

export const TICKET_MANAGE_ROLES = [UserRole.ADMIN, UserRole.SALES, UserRole.SUPPORT] as const;
export const TICKET_LINK_ROLES = [UserRole.ADMIN, UserRole.SALES] as const;
export const SECURITY_CENTER_ROLES = [UserRole.ADMIN, UserRole.SUPPORT, UserRole.SALES] as const;
export const AUDIT_LEDGER_ADMIN_ROLES = [UserRole.ADMIN] as const;
export const DIAGNOSTICS_ROLES = [UserRole.ADMIN, UserRole.SUPPORT] as const;
export const CUSTOMER_360_ROLES = [UserRole.ADMIN, UserRole.SUPPORT, UserRole.SALES] as const;
```
Usage at a call site: `@Roles(...TICKET_MANAGE_ROLES)` — `Roles()` already accepts a rest-spread of
`UserRole[]` (`backend/src/auth/decorators/roles.decorator.ts`), so this requires no change to
`RolesGuard` or the decorator itself.

Apply this to every *new* `@Roles()` site introduced in Phase 1 (§1.1–1.6 below reference these
constants by name). Do **not** retrofit it onto the 45 existing sites in this pass.

### Frontend changes

**New file: `frontend/src/lib/permissions.ts`**
```ts
// Mirrors backend/src/auth/role-groups.ts — same rationale (named groups for new UI, existing
// inline `user?.role === 'admin' || ...` checks elsewhere are left as-is).
import { UserRole } from '@/types';

export const canManageTickets = (role?: UserRole) =>
  role === 'admin' || role === 'sales' || role === 'support';
export const canLinkTickets = (role?: UserRole) =>
  role === 'admin' || role === 'sales';
export const canViewSecurityCenter = (role?: UserRole) =>
  role === 'admin' || role === 'support' || role === 'sales';
export const canViewDiagnostics = (role?: UserRole) =>
  role === 'admin' || role === 'support';
export const canViewCustomer360 = (role?: UserRole) =>
  role === 'admin' || role === 'support' || role === 'sales';
```
Use these in every *new* Phase 1 page/component instead of another inline role-string comparison.
Existing inline checks (`dashboard/support/tickets/[id]/page.tsx` line 46, `dashboard/admin/tickets/page.tsx`
line 68, etc.) are left as-is in this pass, except where Phase 0.1/0.2 already touches that exact
line (Phase 0.1 updates `canEditStatus` — do that update using `canManageTickets` from this new
file rather than another inline literal, since you're already editing that line).

### Acceptance criteria
- `backend/src/auth/role-groups.ts` exists, exports the six constants above, and at least one
  Phase 1 controller (pick any from §1.2–1.6) uses `@Roles(...GROUP_NAME)` instead of a raw list.
- `frontend/src/lib/permissions.ts` exists and at least one Phase 1 page uses it instead of an
  inline role comparison.
- None of the 45 pre-existing `@Roles()` call sites (`grep -rn "@Roles(" backend/src | grep -v spec`)
  changed as part of this item — this is a convention for new code, not a refactor of old code.

---

# PHASE 1

## Phase 1.1 — Support Center: ticket-first default view

### Goal
`/dashboard/support` opens showing open-ticket counts and a recent-tickets list by default;
the current "servers I currently have access to" grid becomes a secondary tab, not the landing view.

### Backend changes
None required. `GET /tickets` is already SUPPORT-accessible (`tickets.controller.ts:157`,
confirmed in §Corrections item 1) and already supports `?status=`; Phase 0.2 adds `?clientId=`
(not needed here). No new aggregation endpoint is needed — the existing `/dashboard/admin/tickets`
page already computes status counts client-side from the full ticket array
(`admin/tickets/page.tsx:115-118`, `tickets.reduce(...)`) and that's an entirely adequate pattern
to reuse at current ticket volumes; do not build a `/tickets/counts` endpoint for this.

### Frontend changes

**File: `frontend/src/app/dashboard/support/page.tsx`** (231 lines today)
- Add local state `const [view, setView] = useState<'tickets' | 'servers'>('tickets')`.
- Add ticket data loading: `const [tickets, setTickets] = useState<Ticket[]>([])`, fetched via
  `staffTicketsApi.getAll()` in the same `useEffect` that currently calls `loadServers()` (line 59-62).
- Default-rendered content (when `view === 'tickets'`): status counts (reuse the `reduce`-into-`counts`
  pattern from `admin/tickets/page.tsx:115-118`) for `new`/`in_progress`/`waiting_client`, plus a list
  of the most recent open tickets (status in `['new','in_progress','waiting_client']`, e.g. top 10 by
  `createdAt DESC` — already the sort order `GET /tickets` returns) rendered with the existing
  `StaffTicketCard` component (`frontend/src/components/staff/StaffTicketCard.tsx`) — it already
  links to `/dashboard/support/tickets/[id]`, no new component needed for the row itself.
- A small tab/segmented control switches `view` to `'servers'`, which renders the *existing*
  server-grid JSX (lines 109-227 today) unchanged. Recommend extracting that block into
  `frontend/src/components/support/ServerAccessGrid.tsx` (props: `servers`, `loading`, `connecting`,
  `onConnect`) purely for readability — not required for acceptance, but keeps the page file from
  growing past its current 231 lines with two full views inlined.
- The existing "Tickets" nav card (lines 195-209, linking to `/dashboard/support/tickets` for the
  full list/filter UI) stays — the new default view is a *summary*, not a replacement for the full
  ticket list page.
- Keep the existing `useServersSocket` live-update wiring (lines 74-82) attached regardless of which
  tab is active, so switching to the Servers tab doesn't need a fresh fetch.

### Acceptance criteria
- Loading `/dashboard/support` as SUPPORT or ADMIN shows ticket status counts and a ticket list by
  default; the server grid is not visible until the Servers tab is selected.
- Switching to the Servers tab reproduces exactly today's behavior: only `accessEnabled` servers
  shown, "Get Access" button, `CredentialsModal` on connect, live updates via `useServersSocket`.
- A ticket row in the default view links to `/dashboard/support/tickets/[id]` and that page loads
  correctly (no change to the detail page's own data-fetching).
- No new backend endpoint was added for this item (verify via `git diff backend/` for this item is empty).

---

## Phase 1.2 — Security Center

### Goal
Give ADMIN a single place that surfaces both the already-built event browser (`GET /access/logs`)
and the currently-unused hash-chain integrity endpoints (`GET /access/audit-verify`,
`GET /access/audit/:accessLogId`); give SUPPORT/SALES a scoped version of the event browser (the
frontend component already anticipates this — see the comment in
`frontend/src/app/dashboard/admin/access-logs/page.tsx:47-51`).

### Backend changes
None required for the event-browser part — `GET /access/logs` and `GET /access/sessions/:accessLogId`
are already correctly role-scoped (§Corrections item 2). The only backend touch is optional role
tightening using the new constant:

**File: `backend/src/access/access.controller.ts`**
- Lines 98-99, 115-116: replace `@Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.SALES)` with
  `@Roles(...SECURITY_CENTER_ROLES)` (from `role-groups.ts`, §Phase 0.3) — cosmetic, behavior-identical.
- Lines 146-157 (`getAuditTrail`, `verifyAuditChain`): leave as `@Roles(UserRole.ADMIN)` /
  `@Roles(...AUDIT_LEDGER_ADMIN_ROLES)` — these stay ADMIN-only. They verify the *entire* ledger
  and expose raw hash-chain internals (`seq`/`hash`/`prevHash`); no product requirement in this
  pass calls for exposing them to SUPPORT/SALES, and doing so would need its own scoping design
  (the current `getAccessLogDetail` ticket-scope pattern doesn't apply to a global chain-verify call).

**New file: `backend/src/access/dto/audit-trail-view.dto.ts`** (thin, for the frontend type mirror only)
```ts
export interface AuditTrailEventView {
  id: string;
  seq: string;
  eventType: AuditEventType;
  accessLogId: string;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  prevHash: string | null;
  hash: string;
}
```
This is what `AuditLogService.getEventsForAccessLog` (called by `AccessService.getAuditTrail`)
already returns per-row (the raw `AuditEvent` entity, `backend/src/access/entities/audit-event.entity.ts`) —
this DTO just documents the shape for the frontend mirror, no service change needed.

### Frontend changes

**File: `frontend/src/app/dashboard/admin/access-logs/page.tsx`**
- Add a "Chain Integrity" panel above or beside `AccessLogList`: a button that calls
  `GET /access/audit-verify` (new `accessApi.verifyAuditChain()` wrapper — see below) and renders
  `{ valid: true }` as a green state or `{ valid: false, brokenAtEventId }` as a red alert with the
  offending event id. This is the entire "surface audit-verify" requirement — the backend already
  does the real work (`AuditLogService.verifyChain`, `access/audit-log.service.ts:76-98`).

**File: `frontend/src/services/access.api.ts`**
- Add:
  ```ts
  verifyAuditChain: () =>
    api.get<{ valid: boolean; brokenAtEventId?: string }>('/access/audit-verify').then(r => r.data),
  getAuditTrail: (accessLogId: string) =>
    api.get<AuditTrailEventView[]>(`/access/audit/${accessLogId}`).then(r => r.data),
  ```

**File: `frontend/src/components/access/AccessLogDetailsDrawer.tsx`**
- ADMIN-only addition (gated by the existing `showRawMetadata` prop, which is already `true` only
  on the ADMIN page): a new collapsible "Cryptographic trail" section that calls
  `accessApi.getAuditTrail(accessLogId)` and renders each event's `seq`/`hash`/`prevHash` in
  monospace — this is the "surface `GET /access/audit/:accessLogId`" requirement. Keep it a
  separate lazy fetch (only triggered on expand), not part of the drawer's main `load()`, since most
  viewings of a session detail won't need the raw chain.

**New file: `frontend/src/app/dashboard/support/security/page.tsx`**
- Mirrors `admin/access-logs/page.tsx`'s structure but role-gated for SUPPORT+SALES (redirect via
  `canViewSecurityCenter` from §Phase 0.3) and renders `<AccessLogList showStaffFilter={false} showRawMetadata={false} />` —
  literally what the comment at `admin/access-logs/page.tsx:47-51` already says this would look like.
  No "Chain Integrity" panel on this page (that stays ADMIN-only per the backend gate above).
- Add a nav entry point from `frontend/src/app/dashboard/support/page.tsx` (a second nav card next
  to the existing "Tickets" one, same visual pattern, lines 195-209) linking here.

**File: `frontend/src/types/index.ts`**
- Add `AuditTrailEventView` interface mirroring the backend DTO above.

### Acceptance criteria
- ADMIN visiting `/dashboard/admin/access-logs` sees a working "Verify chain" action; on a healthy
  ledger it reports valid; if a row in `audit_events` is manually tampered with in the test DB and
  the action is retried, it reports invalid with the correct `brokenAtEventId`.
- ADMIN can expand a session's cryptographic trail in `AccessLogDetailsDrawer` and see `hash`/`prevHash`
  per event; SUPPORT/SALES visiting `/dashboard/support/security` never see this control
  (`showRawMetadata={false}` — verify by inspecting rendered DOM, not just prop passing).
- SUPPORT visiting `/dashboard/support/security` sees only events in their existing ticket-scope
  (unchanged backend behavior — verify this is the *same* restriction already enforced for
  `/dashboard/admin/access-logs` when logged in as SUPPORT, i.e. nothing regressed).
- CLIENT role hitting `GET /access/audit-verify` or `/dashboard/support/security` → 403 / redirect.

---

## Phase 1.3 — Diagnostics Center

### Goal
Move the CPU/RAM/Disk/live-connection UI out of the ADMIN-only `HubDrawer` into its own page,
open it to SUPPORT (scoped to servers they currently have access to, mirroring every other
SUPPORT-facing restriction in this app), and show the `publicStatus`/UNREACHABLE signal that's
already computed server-side but not rendered in this view today.

### Backend changes

**File: `backend/src/tinta-core/tinta-core.controller.ts`**
- `getDiagnostics` (lines 48-52): change `@Roles(UserRole.ADMIN)` → `@Roles(...DIAGNOSTICS_ROLES)`
  (`[ADMIN, SUPPORT]`, §Phase 0.3). Add a SUPPORT-only ownership/access check before delegating to
  the service — mirrors the existing pattern in `servers.controller.ts:58-72` (`findOne`, SUPPORT
  restricted to `accessEnabled` servers):
  ```ts
  @Get('diagnostics/:clientId')
  @Roles(...DIAGNOSTICS_ROLES)
  async getDiagnostics(@Param('clientId') clientId: string, @CurrentUser() user: AuthenticatedUser) {
    if (user.role === UserRole.SUPPORT) {
      const servers = await this.serversService.findByClientId(clientId);
      if (!servers.some(s => s.accessEnabled)) {
        throw new ForbiddenException('Access to this client\'s server is not currently granted');
      }
    }
    return this.coreService.getDiagnostics(clientId);
  }
  ```
  This requires injecting `ServersService` into `TintaCoreController` (not currently injected there —
  `TintaCoreModule` already imports `ServersModule`, so this is a constructor param addition only,
  no module-graph change).

**File: `backend/src/hubs/hubs.service.ts`**
- `Hub` interface (lines 9-41): add `publicStatus: ServerPublicStatus; publicCheckedAt: Date | null;`.
- `findAll` (lines 79-119) and `findOne` (lines 121-157): add `publicStatus: srv.publicStatus,
  publicCheckedAt: srv.publicCheckedAt ?? null,` to both object literals (the underlying `Server`
  entity already carries both columns — this is purely "stop dropping them on the floor").
- Import `ServerPublicStatus` from `../servers/entities/server.entity.ts`.

No new endpoint needed for the diagnostics *list* view — `GET /servers` already returns
`publicStatus`/`publicCheckedAt` for both ADMIN (raw entity) and SUPPORT (`toSupportServerView`,
already includes both fields per §Corrections item 7) and needs no change.

**Migration**: none — both columns already exist (`006_server_public_status.sql`, pre-dates this spec).

### Frontend changes

**New file: `frontend/src/app/dashboard/diagnostics/page.tsx`** (list view, role-gated ADMIN+SUPPORT
via `canViewDiagnostics`)
- Data source: `GET /servers` (role-appropriate response shape already handled server-side — ADMIN
  gets the full list, SUPPORT gets `findAccessibleForSupport()`'s `accessEnabled`-only subset).
- Each row: server name, `status` (online/offline dot, reuse the existing `StatusDot` pattern from
  `dashboard/support/page.tsx:15-22`), and a new `PublicStatusBadge` reused as-is from
  `frontend/src/app/dashboard/client/page.tsx:46` (recommend extracting it to a shared component,
  e.g. `frontend/src/components/PublicStatusBadge.tsx`, since it's about to have three call sites:
  client dashboard, this new page, and optionally the Hubs page).
- Clicking a row navigates to `/dashboard/diagnostics/[serverId]`.

**New file: `frontend/src/app/dashboard/diagnostics/[serverId]/page.tsx`** (detail view)
- On mount, calls `GET /tinta-core/diagnostics/:clientId` (the server row already carries `client.id`
  for ADMIN; for SUPPORT's `toSupportServerView` shape it's `server.client.id` too, per the DTO at
  §Corrections item 7 confirmation — same field name both shapes).
- **Resolves the "two data sources" issue from §Corrections item 6**: render the *live* report's
  `cpuPercent`/`memPercent`/`diskPercent`/`haConnected`/`agentVersion`/`haVersion`/`nodeVersion`/`platform`/`uptimeSeconds`
  when `agentOnline && report` is truthy (this is the `DiagnosticsReport` shape,
  `backend/src/tinta-core/tinta-agent.gateway.ts:35-47`); fall back to whatever the caller has on
  hand from the stale snapshot only for `deviceCount`/`automationCount`, which don't exist on the
  live report at all — those two fields stay sourced from `AgentSession.metrics` and are only
  available to ADMIN today (via `GET /hubs`), so gate their display on `role === 'admin'` and treat
  their absence for SUPPORT as an acceptable, explicitly-noted current limitation, not a bug to fix
  in this pass.
- Show `publicStatus`/`publicCheckedAt` prominently (this is the literal "UNREACHABLE signal" the
  task asks for) using the shared `PublicStatusBadge`, sourced from the server row already fetched
  by the list page (pass via route state or refetch `GET /servers/:id` — either is fine; refetching
  is simpler and matches how the rest of this app handles drill-down navigation, e.g. ticket detail
  pages).

**File: `frontend/src/app/dashboard/admin/hubs/page.tsx`**
- `HubDrawer`'s "Agent" section (lines 592-639): replace the `MetricBar`×3 block (lines 628-638) and
  the ad hoc `checkDiagnostics`/`diag` state (lines 362-363, 389-397, 600-617) with a single link
  ("Open in Diagnostics Center →" or similar) to `/dashboard/diagnostics/[hub.id]`. Keep the
  online/offline dot, agent version, HA version, `lastConnectedAt`, and `lastTokenMismatchAt` rows
  as-is (lines 594-627) — those are cheap, already-fetched summary fields appropriate for a drawer;
  only the "requires its own round-trip and was being discarded" live-diagnostics affordance moves out.
- `Hub` interface (lines 50-71): add `publicStatus: 'reachable' | 'unreachable' | 'unknown';
  publicCheckedAt: string | null;` matching the backend addition above.
- `HubCard` (lines 220-...): optionally add the `PublicStatusBadge` next to the existing online/offline
  `StatusDot` — not required for acceptance but consistent with surfacing the signal "in the same view."

### Acceptance criteria
- SUPPORT with an active (`accessEnabled`) session on server X: `GET /tinta-core/diagnostics/:clientIdOfX` → 200.
- Same SUPPORT user, server Y they do not currently have access to: `GET /tinta-core/diagnostics/:clientIdOfY` → 403.
- ADMIN: unrestricted, as before.
- `/dashboard/diagnostics` lists servers with a visible reachable/unreachable/unknown badge sourced
  from `Server.publicStatus`, matching what `/dashboard/client` already shows for the same server.
- `/dashboard/diagnostics/[serverId]` detail view, when the agent is online and answers in time,
  shows live CPU/RAM/Disk (not the stale snapshot) — verify by comparing the displayed percentage
  to a value forced via a test agent connection, not just checking the field renders.
- `GET /hubs` response now includes non-null `publicStatus` for every server that has been probed
  at least once by `ServersPublicStatusScheduler`.

---

## Phase 1.4 — Provisioning hardening (audit, not rebuild)

### Goal
Fix concrete gaps found by auditing the existing 3-step `CreateHubWizard`
(`frontend/src/app/dashboard/admin/hubs/page.tsx:815-1005`) and `provisionClient`
(`backend/src/provisioning/provisioning.service.ts:81-214`) against the checklist in the task
(validation / error-handling / retry / duplicate-provisioning / token-expiration /
failed-installation / agent-reconnect / final-verification). The wizard and
`scripts/provision-client.sh` already both call the single canonical endpoint
`POST /provisioning/client` — no reconciliation work is needed there (§Corrections item 9); both
clients automatically inherit every backend fix below.

### Audit findings, in priority order

**[HIGH] Re-provisioning an existing client for a second server silently disconnects their first
server's agent.** `AgentSession.clientId` is `@Column({ unique: true })`
(`backend/src/tinta-core/entities/agent-session.entity.ts:26-27`) — one session row per *client*,
not per *server*. But `Server.client` is a plain `@ManyToOne` with no uniqueness constraint — a
client can already have multiple servers (the wizard's "existing client" mode in
`CreateHubWizard` step 1, lines 899-906, exists specifically to add a second server to an existing
account). `ProvisioningService.provisionClient` (line 148) unconditionally calls
`this.tintaCore.provisionAgent(client.id)` for every call, and `TintaCoreService.provisionAgent`
(`tinta-core.service.ts:44-84`) — when a session already exists for that `clientId` — **rotates the
token and calls `gateway.disconnectAgent(clientId, ...)`** (line 65-68), forcibly dropping whatever
agent is currently connected under the old token. If that client's *first* server has a live,
working agent connection, adding a second server for them silently kills it.
- **Fix**: in `provisioning.service.ts`, before calling `this.tintaCore.provisionAgent(client.id)`,
  check whether a session already exists and is `AgentStatus.CONNECTED`
  (`this.tintaCoreService` needs a new small method, e.g. `hasConnectedSession(clientId): Promise<boolean>`,
  backed by `sessionRepo.findOne({ where: { clientId, status: AgentStatus.CONNECTED } })`). If true,
  throw `ConflictException('This client already has a connected agent session — rotating it now
  would disconnect it. Confirm to proceed.')` unless the request explicitly opts in. Add an
  `allowSessionRotation?: boolean` field to `ProvisionClientDto` (`@IsOptional() @IsBoolean()`);
  when the conflict would occur and the flag isn't set, return the 409 instead of proceeding.
- **Frontend**: `CreateHubWizard`, `mode === 'existing'` branch — when the 409 comes back, show a
  confirm dialog ("This client's current agent will be disconnected — continue?") and resubmit with
  `allowSessionRotation: true` on confirm.
- This is the one item in this list that changes provisioning *behavior*, not just error handling —
  flag it for explicit review since it changes what "add a second server" does by default (from
  silent disconnect to a confirmed action).

**[MED] Duplicate subdomain surfaces as an unhandled 500, not a 409.** `provisioning.service.ts`
lines 136-141 call `this.serversService.create(...)` with no try/catch, unlike the email-duplicate
path four lines above it (lines 108-123, which explicitly catches `err.code === '23505'` →
`ConflictException('Email already exists')`). `Server.subdomain` is `@Column({ unique: true })`
(`backend/src/servers/entities/server.entity.ts:41-42`), so a repeat subdomain throws a raw Postgres
unique-violation that propagates through `AllExceptionsFilter` as a generic 500.
- **Fix**: wrap the `serversService.create(...)` call in the same try/catch pattern, mapping
  `err.code === '23505'` → `ConflictException('Subdomain already in use')`.

**[MED] No monitoring catches an agent session that never connects at all (failed installation).**
`AgentMonitorScheduler.checkAgentHealth` (`backend/src/tinta-core/agent-monitor.scheduler.ts:23-81`)
only queries `where: { status: AgentStatus.CONNECTED, lastHeartbeatAt: LessThan(threshold) }` — a
session created by `provisionAgent` starts at `AgentStatus.DISCONNECTED` (the entity default) and
*stays* `DISCONNECTED` forever if the client never completes the HA add-on install. This query never
matches it, so a failed/abandoned installation produces zero alerts, ever.
- **Fix**: add a second check in the same scheduler run: sessions where
  `status = DISCONNECTED AND lastConnectedAt IS NULL AND installTokenExpiresAt < now()` (i.e. the
  48h install window has closed and the agent has *never once* connected) — auto-create a ticket the
  same way the existing stale-heartbeat path does (reuse the `[AUTO] ...` ticket pattern, lines
  54-67 of the same file), gated by the same `alertedClients` dedup set so it fires once.

**[LOW] No way to regenerate an expired install link without re-running the whole wizard.**
`HubDrawer`'s "Activation" section (`hubs/page.tsx:641-657`) displays the install token and its
expiry but has no action button. `POST /tinta-core/provision/:clientId` (`tinta-core.controller.ts:24-28`,
ADMIN) already does exactly what's needed (rotates/reissues) but nothing in the UI calls it outside
of the initial `CreateHubWizard` submission (which goes through `POST /provisioning/client`, not this
route directly).
- **Fix**: add a "Regenerate install link" button in that section calling
  `POST /tinta-core/provision/${hub.client.id}`, then `onRefresh()`. No backend change needed — the
  endpoint already exists and already does the right thing. **Caveat**: this hits the exact same
  session-rotation behavior as the HIGH finding above if the client has another already-connected
  server sharing the same `clientId`-keyed session — apply the same confirm-before-rotate guard.

**[LOW] No post-provisioning confirmation that the agent actually connected.** `CreateHubWizard`
step 3 (lines 967-1000) shows the install token immediately after the API call returns and never
checks whether the agent subsequently connects. This is explicitly a nice-to-have, not required for
acceptance below (keeping this item's scope to "audit + fix what's broken," per the task framing) —
noted for the developer's judgment call: a bounded poll of `GET /tinta-core/connected` for ~30s
after closing the wizard, surfaced as a toast, would close this gap cheaply if wanted later.

**[LOW] Resubmitting the wizard with an email that already belongs to an existing user silently
attaches a new server to that account with no warning**, because `provisioning.service.ts` lines
90-105 treat "user exists, has no client record yet" and "user exists, has a client record" as
ordinary success paths, not as something to flag back to the admin. Recommend (optional): have
`ProvisionResult` include `reusedExistingAccount: boolean`, and have the wizard toast a distinct
"attached to existing account" message instead of the generic success toast when true. Not required
for acceptance.

### Backend changes
- `backend/src/provisioning/dto/provision-client.dto.ts`: add `allowSessionRotation?: boolean`.
- `backend/src/provisioning/provisioning.service.ts`: the HIGH and MED-subdomain fixes above.
- `backend/src/tinta-core/tinta-core.service.ts`: add `hasConnectedSession(clientId: string): Promise<boolean>`.
- `backend/src/tinta-core/agent-monitor.scheduler.ts`: the failed-installation check above.

### Frontend changes
- `frontend/src/app/dashboard/admin/hubs/page.tsx`: `CreateHubWizard` 409-confirm flow;
  `HubDrawer` "Regenerate install link" button.

### Migration
None — every fix above works against existing columns (`AgentSession.status`, `.lastConnectedAt`,
`.installTokenExpiresAt`, `Server.subdomain`'s existing unique constraint).

### Acceptance criteria
- Provisioning a second server for a client with no currently-connected agent session succeeds
  exactly as before (no behavior change when there's nothing to disconnect).
- Provisioning a second server for a client with a currently-connected agent session → 409 without
  `allowSessionRotation: true`; → 200 (and the old session is rotated/disconnected, as today) with it.
- Submitting the wizard with a subdomain already in use by another server → the wizard shows
  "Subdomain already in use" (from the 409 body), not a generic/opaque error.
- A freshly-provisioned session that never connects, once its 48h install token has expired,
  produces exactly one auto-created ticket (verify no duplicate on a second scheduler tick).
- `HubDrawer`'s Activation section has a working "Regenerate install link" button that issues a new
  token and updates the displayed expiry.

---

## Phase 1.5 — Customer 360

### Goal
One aggregation endpoint and one page showing everything staff currently has to piece together
across five separate screens for one client: profile, servers, tickets, access/support-session
history, and installation status.

### Backend changes

**New module: `backend/src/customer-360/customer-360.module.ts`**
```ts
@Module({
  imports: [ClientsModule, ServersModule, TicketsModule, AccessModule, TintaCoreModule],
  providers: [Customer360Service],
  controllers: [Customer360Controller],
})
export class Customer360Module {}
```
**Why a new module instead of adding this to `ClientsModule`**: `ClientsModule` is deliberately a
leaf module today — it imports only `UsersModule`
(`backend/src/clients/clients.module.ts:9`) — and `ServersModule`/`AccessModule`/`TicketsModule` all
already depend on it. Adding the reverse dependency (`ClientsModule` importing any of them) would
create an import cycle requiring `forwardRef()` on both sides, for no benefit — `Customer360Module`
sits cleanly on top of all four existing modules the same way `AccessModule`/`TicketsModule`/`TintaCoreModule`
already do, without anyone needing to import it back. Register it in `app.module.ts`'s `imports` array.

**New file: `backend/src/customer-360/customer-360.controller.ts`**
```ts
@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class Customer360Controller {
  constructor(private readonly service: Customer360Service) {}

  @Get(':id/360')
  @Roles(...CUSTOMER_360_ROLES) // [ADMIN, SUPPORT, SALES]
  getCustomer360(@Param('id') id: string) {
    return this.service.getCustomer360(id);
  }
}
```
Note this controller's `@Controller('clients')` prefix intentionally matches the existing
`ClientsController`'s — Nest allows two controller classes to share a route prefix as long as the
concrete paths don't collide (`:id/360` vs. `ClientsController`'s `:id`, `''`, `'me'`), so this adds
`GET /clients/:id/360` without touching `clients.controller.ts` at all.

**New file: `backend/src/customer-360/customer-360.service.ts`**
```ts
@Injectable()
export class Customer360Service {
  constructor(
    private clientsService: ClientsService,
    private serversService: ServersService,
    private ticketsService: TicketsService,
    private accessService: AccessService,
    private tintaCoreService: TintaCoreService,
  ) {}

  async getCustomer360(clientId: string): Promise<Customer360View> {
    const client = await this.clientsService.findById(clientId); // throws NotFoundException if missing
    const [servers, tickets, accessHistory] = await Promise.all([
      this.serversService.findByClientId(clientId),
      this.ticketsService.findAll(undefined, clientId), // uses the Phase 0.2 filter
      this.accessService.getLogsForClient(clientId),
    ]);
    const connectedAgentIds = new Set(this.tintaCoreService.getConnectedAgents());
    // ...shape into Customer360View, see below
  }
}
```

**New file: `backend/src/customer-360/dto/customer-360-view.dto.ts`**
```ts
export interface Customer360View {
  client: {
    id: string; phone: string; address: string | null; city: string | null; country: string;
    isInstalled: boolean; notes: string | null; createdAt: Date;
    user: { id: string; firstName: string; lastName: string; email: string };
  };
  servers: {
    id: string; name: string; subdomain: string; hubId: string | null;
    status: ServerStatus; publicStatus: ServerPublicStatus; publicCheckedAt: Date | null;
    haVersion: string | null; accessEnabled: boolean; accessExpiresAt: Date | null;
    lastSeenAt: Date | null; agentOnline: boolean; // derived from tintaCoreService.getConnectedAgents()
  }[];
  tickets: {
    id: string; subject: string; type: TicketType; status: TicketStatus;
    createdAt: Date; updatedAt: Date;
  }[]; // deliberately trimmed — no `message`/`internalNotes` body; link out to GET /tickets/:id for that
  accessHistory: ClientAccessLogView[]; // reuses AccessService.getLogsForClient's existing shape verbatim
}
```
**Note on "servers + tickets + support sessions + access history" from the task**: in this
codebase's data model, "support sessions" and "access history" are the same underlying entity
(`AccessLog`/`audit_events` — `AccessService.getLogsForClient` already *is* "this client's support
session history"). There is no separate support-session concept to surface — the `accessHistory`
field above covers both; don't build a second, redundant array for "support sessions."
`getLogsForClient` today caps at 20 rows when no `ticketId` filter is given (`access.service.ts:359`)
— acceptable for a 360 summary view; note in a code comment that a "view all" link to
`/dashboard/admin/access-logs?clientId=X` (Phase 1.2, using the Phase 0.2 filter) is the way to see
the full history, rather than raising the cap here.

**Migration**: none — no new entity, no new columns, purely a read-side aggregation over
already-existing service methods.

### Frontend changes

**New file: `frontend/src/app/dashboard/admin/clients/[id]/page.tsx`** (role-gated via
`canViewCustomer360`; despite living under `admin/`, allow SUPPORT and SALES too per the backend
roles — this app already has precedent for staff-shared pages living under a specific role's route
segment without being restricted to that role, e.g. `StaffTicketsLayout` under `dashboard/support/`
allows ADMIN/SALES/SUPPORT alike).
- Fetches `GET /clients/:id/360` once on mount.
- Renders four sections: profile header (name/email/phone/address/`isInstalled` badge), a servers
  table (reusing `PublicStatusBadge` from Phase 1.3 and the existing online/offline `StatusDot`
  pattern), a tickets table (status badges, link to `/dashboard/support/tickets/[id]` per row — that
  page is already role-gated for ADMIN/SALES/SUPPORT), and an access-history table (reuse
  `AccessLogTable`/`AccessLogStatusBadge` components from `frontend/src/components/access/` where
  the shape lines up — `ClientAccessLogView` is already what those components partially expect).

**File: `frontend/src/types/index.ts`** — add `Customer360View` mirroring the backend DTO above.

**Entry points** (pick at least one; both is better): a "View full profile" link from
`HubDrawer`'s client name (`hubs/page.tsx`, wherever `hub.client.user.firstName` is currently
rendered as plain text) to `/dashboard/admin/clients/${hub.client.id}`, and/or a client name link
from the `admin/tickets` table row (`admin/tickets/page.tsx:198-201`) once that table exposes
`ticket.client` — no dedicated "client list" page exists in this app today
(`admin/users/page.tsx` is user/account management across all roles, not a client-scoped list), so
don't block this item on building one; direct links from existing screens are sufficient for Phase 1.

### Acceptance criteria
- `GET /clients/:id/360` as ADMIN/SUPPORT/SALES → 200 with all four sections populated for a client
  with ≥2 servers, ≥2 tickets (mixed status), and ≥1 access-log entry in seed data.
- `GET /clients/:id/360` for a client with zero servers/tickets/access history → 200 with empty
  arrays, not an error.
- `GET /clients/:id/360` for a nonexistent client id → 404.
- CLIENT role → 403.
- `/dashboard/admin/clients/[id]` renders all four sections from the single API call (verify via
  network tab: exactly one request to `/clients/:id/360`, not five separate calls).

---

## Phase 1.6 — Ticket linkage cleanup

### Goal
Give staff a way to attach an anonymous `/tickets/public` lead (currently permanently
`client: null, server: null`) to a real client + server after the fact — e.g. a sales lead that
converts into a paying, provisioned client — with a durable record of who did it and when.

### Backend changes

**New file: `backend/src/tickets/dto/link-ticket.dto.ts`**
```ts
export class LinkTicketDto {
  @IsUUID()
  clientId: string;

  @IsUUID()
  serverId: string;
}
```
Both required — this codebase's model treats `client`/`server` as set together or not at all
(`ticket.entity.ts:57-72`'s comments confirm portal tickets always set both); allowing a
partially-linked state here would introduce a case nothing else in the app expects.

**File: `backend/src/tickets/tickets.service.ts`**
- New method:
  ```ts
  async linkTicket(
    ticketId: string,
    clientId: string,
    serverId: string,
    actor: { id: string; role: UserRole },
  ): Promise<Ticket> {
    const ticket = await this.findById(ticketId);
    if (ticket.client || ticket.server) {
      throw new ConflictException('Ticket is already linked to a client/server');
    }
    // Reuses the existing private assertServerOwnership (line 91-100) — it already throws
    // ForbiddenException if serverId doesn't belong to clientId, and NotFoundException if
    // serverId doesn't exist at all, which also covers "clientId doesn't exist" for practical
    // purposes (a bogus clientId can never legitimately own a real serverId).
    await this.assertServerOwnership(serverId, clientId);

    await this.ticketsRepository.update(ticketId, {
      client: { id: clientId } as any,
      server: { id: serverId } as any,
    });

    await this.ticketMessagesRepository.save(this.ticketMessagesRepository.create({
      ticket: { id: ticketId } as any,
      author: { id: actor.id } as any,
      authorRole: actor.role,
      internal: true,
      message: `Ticket linked to client/server by staff.`, // include resolved names if convenient
    }));

    return this.findById(ticketId);
  }
  ```
  Same audit-trail mechanism as Phase 0.1 (an internal `TicketMessage`), for the same reason: this
  is a ticket-scoped staff action, not an access-session lifecycle event, so it does not belong in
  the `audit_events` hash chain (see the architectural note in §Phase 0.1 — it applies identically
  here). Keeping both features on the same mechanism is deliberate for consistency.

**File: `backend/src/tickets/tickets.controller.ts`**
```ts
@Post(':id/link')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...TICKET_LINK_ROLES) // [ADMIN, SALES]
async linkTicket(
  @Param('id') id: string,
  @Body() dto: LinkTicketDto,
  @CurrentUser() user: AuthenticatedUser,
) {
  const ticket = await this.ticketsService.linkTicket(id, dto.clientId, dto.serverId, { id: user.id, role: user.role });
  return user.role === UserRole.ADMIN ? ticket : { ...ticket, server: ticket.server ? toSupportServerView(ticket.server) : null };
}
```
Method is `POST` per the task's exact example path (`POST /tickets/:id/link`), not `PATCH` —
followed as given even though this is semantically closer to a partial update, for consistency with
what the task specified.
Role choice: `TICKET_LINK_ROLES = [ADMIN, SALES]`, not SUPPORT — this is a lead-qualification/data-
correction action most naturally owned by whoever handles inbound sales/installation leads (SALES
already owns `TicketType.SALES`/`INSTALLATION` public leads); SUPPORT's existing role in this app is
scoped to already-linked, already-provisioned clients.

**This is now a fixed product decision, not an open judgment call** (confirmed 2026-09-11):

**Anonymous Ticket Linkage**

| Action | ADMIN | SALES | SUPPORT |
|---|---|---|---|
| View an anonymous ticket | ✓ | ✓ | ✓ |
| Attach ticket to a Client | ✓ | ✓ | — |
| Attach ticket to a Server | ✓ | ✓ | — |
| Change existing linkage | ✓ | ✓ | — |
| Remove linkage | ✓ | ✓ | — |

Rationale: an anonymous ticket is fundamentally a lead/customer-identification process. SALES owns
converting a lead into a client; ADMIN has full operational control; SUPPORT should not unilaterally
change customer ownership / CRM-level associations.

SUPPORT **may**: view the resolved Client/Server linkage once set, work the ticket, update ticket
status (Phase 0.1), add public replies and internal notes per existing permissions.

SUPPORT **may not**: assign ownership of an anonymous lead, attach the ticket to a Client, attach or
change the ticket's Server. `TICKET_LINK_ROLES = [ADMIN, SALES]` is therefore final for `POST
:id/link` (Phase 1.6) — do not later treat SUPPORT's absence from this list as an oversight to "fix"
by adding SUPPORT back in. A remove/unlink or change-linkage endpoint, if built, must use the same
`TICKET_LINK_ROLES` group for the identical reason.

**Migration**: none — `tickets.client`/`tickets.server` columns already exist and are already
nullable (`sql/008_client_tickets.sql`); `ticket_messages` already exists (`sql/009_ticket_messages.sql`).

### Frontend changes

**New file: `frontend/src/components/staff/LinkTicketPanel.tsx`**
- Props: `ticket: Ticket`, `onLinked: (updated: Ticket) => void`.
- Rendered only when `!ticket.client` (the field already exists on the frontend `Ticket` type,
  `types/index.ts:91`) and `canLinkTickets(user?.role)` (§Phase 0.3).
- Two `<select>`s: client (fetched via `api.get('/clients')`, same ad hoc call style already used in
  `CreateHubWizard`, `hubs/page.tsx:838` — no new service file required to stay consistent with
  existing conventions, though adding one is a reasonable alternative if the developer prefers it),
  and server (fetched via `api.get('/servers')`, filtered client-side to `s.client?.id === selectedClientId`
  once a client is picked — mirrors how `AccessLogFilters.tsx` already sources its server list).
- Submit button calls `POST /tickets/:id/link`; on success, calls `onLinked(response.data)` so the
  parent page's ticket state updates without a full reload; on 409 (already linked — a race with
  another staff member), show a toast and refetch the ticket.

**File: `frontend/src/app/dashboard/support/tickets/[id]/page.tsx`**
- Render `<LinkTicketPanel ticket={ticket} onLinked={setTicket} />` near the top of the page
  (above or alongside the existing status/conversation sections), conditionally per the component's
  own internal guard.

**File: `frontend/src/app/dashboard/admin/tickets/page.tsx`**
- Same addition inside the ticket detail `Modal` (around line 240, near the existing contact-info block).

### Acceptance criteria
- ADMIN or SALES: `POST /tickets/:id/link` with a valid `{clientId, serverId}` where `serverId`
  belongs to `clientId`, on a ticket with `client: null` → 200, ticket now has both set, and
  `GET /tickets/:id/messages` shows a new internal note recording the link action.
- Same call on a ticket that already has `client` set → 409, no changes made.
- `{clientId, serverId}` where `serverId` does not belong to `clientId` → 403 (via the reused
  `assertServerOwnership` check), no changes made.
- SUPPORT role: `POST /tickets/:id/link` → 403 (per the `TICKET_LINK_ROLES` choice above — confirm
  this matches the intended product decision before implementing; it's the one open judgment call
  in this item).
- `/dashboard/support/tickets/[id]` for an unlinked ticket, viewed as ADMIN/SALES, shows the link
  panel; viewed as SUPPORT, does not (panel absent from the DOM, not just visually hidden).
- After linking, the ticket detail page immediately reflects the linked client/server without a
  manual page refresh.
