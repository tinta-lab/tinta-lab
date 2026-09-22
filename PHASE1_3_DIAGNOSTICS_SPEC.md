# Tinta Lab — Phase 1.3 Diagnostics Center — Technical Specification

Scope: design, not implementation. This document exists to be reviewed and
argued with *before* any backend/frontend code is written — see
`PHASE0_PHASE1_SPEC.md` §Phase 1.3 for the original one-paragraph ask this
expands into a full contract.

All facts below were verified against the actual repo at
`/home/tinta/tinta-lab` on 2026-09-18. Corrections to assumptions made while
drafting this spec are called out inline as **CORRECTION** — read before
implementing, the same convention `PHASE0_PHASE1_SPEC.md` uses.

---

## 0. Corrections to the working assumptions

1. **There is no Cloudflare health-check API call anywhere in this codebase.**
   `CloudflareService` (`backend/src/cloudflare/cloudflare.service.ts`) only
   exports `provisionServer`, `createAccessApp`, `ensureReusablePolicy`,
   `deleteAccessApp`, `deleteTunnel`, `deleteDnsRecord` — all mutating
   operations, none of them a status/health read. The **only** live signal
   for "is this client's tunnel/DNS/Access chain actually working" is
   `Server.publicStatus` / `Server.publicCheckedAt`
   (`servers/entities/server.entity.ts:78-84`), populated every 2 minutes by
   `ServersPublicStatusScheduler` (`servers/servers-public-status.scheduler.ts`)
   probing the public hostname over HTTP(S) — it does **not** call the
   Cloudflare API at all, it just tells you whether the end-to-end path
   (tunnel + DNS + Access + backend) currently answers — concretely: the
   probe proves only that `client public URL → HTTP(S) request → expected
   endpoint responds`, nothing about the health of any individual link in
   that chain. The Diagnostics Center's check is conceptually **"Public
   connectivity"**, not "Cloudflare health" — it keeps the machine key
   `cloudflare` (existing product/UI terminology already uses that term for
   this signal), but **the `cloudflare` status is an indirect end-to-end
   public reachability signal. It must never be interpreted as confirmation
   that Cloudflare API/control-plane state is healthy.** Do not design a
   check that implies a direct Cloudflare status read, and do not let a
   future reader see the key `cloudflare` and go looking for a
   `cloudflareService.getHealth()` that doesn't exist — this correction is
   the reason it doesn't.
2. **There is no Provisioning state machine yet** (Phase 1.4, not started —
   confirmed via the Phase 2 contract audit: no `allowSessionRotation`, no
   `hasConnectedSession`, no formal states on `AgentSession`). The
   "Provisioning" diagnostic check in §5 below is therefore a *derived*
   status computed from the raw fields `AgentSession` already has
   (`installTokenExpiresAt`, `serviceStartConsentAt`, `lastConnectedAt`), not
   a read of a real state machine. Once Phase 1.4 lands a formal state
   column, this check's `evidence` should switch to reporting that state
   directly — noted as a forward-compat seam, not implemented now.
   **`serviceStartConsentAt` is evidence only in v1 — it does not
   independently determine `provisioning`'s status.** The real-world
   lifecycle of when consent is expected relative to install-token issuance
   isn't confirmed against the actual provisioning flow at spec time, so
   this document deliberately does not invent a rule for it (e.g. "no
   consent yet → WARNING") — see §5's `provisioning` row for the exact,
   narrower rule that *is* specified now.
3. **Audit chain verification is global, not per-client.**
   `AuditLogService.verifyChain()` (`access/audit-log.service.ts:76-98`)
   walks every `AuditEvent` row in the whole ledger in `seq` order — there is
   no `WHERE clientId = ...` scoping, and the hash chain's whole point is
   that each event's `prevHash` depends on the *previous event in the entire
   ledger*, not a per-client sub-chain. Running the full walk on every
   Diagnostics page load (potentially once per client, many times a day)
   would be wasteful and provides no client-specific signal anyway — a
   tampered event for a *different* client would still show up as "broken"
   here. The Diagnostics "Audit" check therefore does **not** call
   `verifyChain()`. It reports something client-scoped and cheap instead:
   whether this client's own `access_logs`/`audit_events` rows exist and the
   most recent one is recent/consistent (see §5). Global chain integrity
   stays exactly where it already lives — the ADMIN-only Security Center's
   "Verify chain" button (`GET /access/audit-verify`).
4. **The "two data sources for Agent metrics" problem is already diagnosed
   and its resolution already decided** — `PHASE0_PHASE1_SPEC.md` §Corrections
   item 6 and §Phase 1.3. Re-stating it here because Diagnostics Center is
   exactly where that resolution has to be implemented: prefer the *live*
   `DiagnosticsReport` (`tinta-agent.gateway.ts:35-47`, fetched via
   `TintaCoreService.getDiagnostics` → `gateway.requestDiagnostics`, only
   available when `agentOnline` and the agent answers within its timeout)
   for `cpuPercent`/`memPercent`/`diskPercent`; fall back to the *stale*
   `AgentSession.metrics` jsonb snapshot only for `deviceCount`/
   `automationCount`, which don't exist on the live report at all. Do not
   re-litigate this — it's a decided design point being carried forward, not
   reopened.
5. **The 5-minute agent-offline threshold already exists and must be
   reused, not reinvented.** `AgentMonitorScheduler`
   (`tinta-core/agent-monitor.scheduler.ts:8`) defines
   `OFFLINE_THRESHOLD_MS = 5 * 60 * 1000` for its own stale-heartbeat alert
   logic. The Diagnostics "Agent" check's staleness evidence must use this
   same constant (extracted to a shared location) so "Agent" never shows
   healthy in Diagnostics while the exact same 5-minute-stale heartbeat is
   independently triggering an `[AUTO]` alert ticket elsewhere — two
   different thresholds drifting apart over time (e.g. Monitor at 5 min,
   Diagnostics at 10 min after an unrelated future edit) would make the two
   systems tell operators contradictory stories about the same agent. This
   extraction is a **mandatory acceptance-criteria item** (§10), not an
   optional cleanup — see §11 step 1.
6. **Audit and Templates checks must use exact, mechanical status rules —
   not language like "consistent" or "default" that a future implementer
   has to independently interpret.** Both are tightened in §5 directly
   (the `audit` row's rule is now `eventCount > 0`/`=== 0`, nothing fuzzier;
   the `templates` row's "active templates" is now defined as exactly what
   `GoldenTemplateService.findAll()` already returns — see that section for
   why there is no separate "default" flag on the entity to reference).
7. **`GET /tinta-core/diagnostics/:clientId` already exists and is exactly
   the live-agent-report primitive this phase builds on top of** — it is
   *not* being replaced. The new Diagnostics Center endpoint (§3) is a
   higher-level aggregation that calls into the same
   `TintaCoreService.getDiagnostics()` internally, alongside the other
   domain reads §5 lists. The existing endpoint keeps its current ADMIN-only gate and
   its current raw `{agentOnline, report}` shape (flagged 🟡 in the Phase 2
   contract matrix as a hygiene item, not touched by this phase) — nothing
   about it changes.

---

## 1. Domain model

```
ClientDiagnosticsDto
├── clientId
├── overallStatus: DiagnosticStatus
├── checkedAt: Date
├── checks: DiagnosticCheckDto[]   ← the actual payload; everything else is context
├── client:  { id, firstName, lastName, email, isInstalled }
├── server:  { id, name, subdomain, status, publicStatus } | null   (client's primary/first server — see §7 on multi-server clients)
└── hub:     { id, agentOnline, agentVersion, haVersion } | null
```

`checks[]` is the actual diagnostic payload — one `DiagnosticCheckDto` per
domain in §5 (**11 domains, not 10** — `client`, `hub`, `server`, `agent`,
`homeAssistant`, `cloudflare`, `supportAccess`, `resources`, `templates`,
`audit`, `provisioning`), always present (never omitted, even when
`UNKNOWN`), so a consumer can render a fixed-order checklist without
conditionally handling missing entries. `checks.length === 11` is a fixed
invariant for v1 — `checks` is never empty and never partial; there is no
mechanism in this spec that produces fewer or more than 11 entries.

```ts
export enum DiagnosticStatus {
  OK = 'ok',
  WARNING = 'warning',
  ERROR = 'error',
  UNKNOWN = 'unknown',
}

export class DiagnosticCheckDto {
  key: DiagnosticCheckKey;       // stable machine key, e.g. 'agent'
  status: DiagnosticStatus;
  code: string;                  // stable machine code, e.g. 'AGENT_OFFLINE'
  title: string;                 // short human label, already localized server-side? — see §6
  message: string;               // one-sentence human explanation
  checkedAt: Date;                // when THIS check's underlying data was captured — see §4 (freshness)
  evidence: Record<string, unknown> | null;  // structured, check-specific facts — see §5 for the exact shape per check
}
```

**Why `evidence` is `Record<string, unknown>`, not a per-check typed class**:
every other DTO in this codebase types its fields precisely — this is a
deliberate, narrow exception. Eleven different checks (§5) each have a
genuinely different evidence shape (agent evidence has `lastHeartbeatAt`;
`cloudflare` evidence has `publicCheckedAt`; audit evidence has
`eventCount`). A discriminated union keyed on `key` is the "correct" typed
alternative and should be revisited once this ships and the shapes stop
moving — for the first cut, a loosely-typed bag keeps the DTO stable while
individual checks' evidence fields are still being tuned against real
support usage. Document each check's *actual* evidence fields in code
comments on the function that produces it (see §5's per-check field lists),
so `Record<string, unknown>` isn't a license to put anything there.

### `overallStatus` aggregation rule

Implemented as an explicit severity function, not just a stated ordering —
this is what makes it independently unit-testable (§10) apart from any
individual check's logic:

```ts
const STATUS_SEVERITY: Record<DiagnosticStatus, number> = {
  [DiagnosticStatus.OK]: 0,
  [DiagnosticStatus.UNKNOWN]: 1,
  [DiagnosticStatus.WARNING]: 2,
  [DiagnosticStatus.ERROR]: 3,
};

function aggregateStatus(checks: DiagnosticCheckDto[]): DiagnosticStatus {
  return checks.reduce(
    (worst, c) =>
      STATUS_SEVERITY[c.status] > STATUS_SEVERITY[worst] ? c.status : worst,
    DiagnosticStatus.OK,
  );
}
```

`checks` is never empty in v1 (§1's fixed `checks.length === 11`), so the
empty-array case (`aggregateStatus([]) === OK` by the reduce's seed value)
is a defined-but-unreachable edge in practice — worth a unit test anyway
since the function itself doesn't enforce non-emptiness.

One explicit rule embedded in the severity ordering: **`UNKNOWN` is not
worse than `WARNING`, and never escalates to `ERROR`** — this is the
directive in the request ("UNKNOWN ≠ ERROR"). Concrete test cases this
implies (§10):

| checks | overallStatus |
|---|---|
| `[OK]` | `OK` |
| `[UNKNOWN]` | `UNKNOWN` |
| `[WARNING, UNKNOWN]` | `WARNING` |
| `[ERROR, UNKNOWN, UNKNOWN, UNKNOWN, UNKNOWN]` | `ERROR` |

The last row is the one worth stating in prose too: a client with one
`ERROR` check and four `UNKNOWN` checks has `overallStatus = ERROR`
(correct — something is actually broken); a client with zero
`ERROR`/`WARNING` checks and one `UNKNOWN` check has `overallStatus =
UNKNOWN`, not `OK` — the operator should still see "we don't know" rather
than a false-clean "all OK", but it must render visually distinct from
`WARNING`/`ERROR` (see §6) so it doesn't read as an active problem.

### `checkedAt` must never be inherited from the aggregate

**A `DiagnosticCheckDto.checkedAt` must never be set from
`ClientDiagnosticsDto.checkedAt`.** The top-level `checkedAt` is
aggregation time (§4 item 1) — when the API assembled the response. Each
check's own `checkedAt` is when *that check's underlying observation* was
captured (§4 item 2), and these two routinely differ: `cloudflare.checkedAt`
must be `Server.publicCheckedAt` (possibly ~2 minutes old), never "now";
`agent.checkedAt` must be the live round-trip time when online or
`AgentSession.lastHeartbeatAt` when not, never "now" either. Getting this
wrong is an easy, silent mistake (copy-pasting the same `new Date()` call
into every check) that would make the frontend show e.g. "Cloudflare
checked 14:32" when the actual probe ran at 14:30 — misleading exactly the
kind of person (SUPPORT, mid-incident) this feature exists to help.

---

## 2. RBAC

Reuses `DIAGNOSTICS_ROLES` from `backend/src/auth/role-groups.ts:320`
(`[ADMIN, SUPPORT]`) — already defined, already referenced by
`PHASE0_PHASE1_SPEC.md` §Phase 1.3, never used yet (confirmed: `grep
DIAGNOSTICS_ROLES backend/src/tinta-core/tinta-core.controller.ts` → no
hits, per the Phase 2 audit). This phase is the first real consumer.

**Ownership rule** (SUPPORT is not ADMIN-equivalent here): mirrors the
existing pattern at `tinta-core.controller.ts`'s planned
`getDiagnostics(:clientId)` guard from `PHASE0_PHASE1_SPEC.md` §Phase 1.3 —
SUPPORT may view a client's Diagnostics only if at least one of that
client's servers currently has `accessEnabled: true`. This is **the same
scope rule already used everywhere else SUPPORT touches a client's data**
(`servers.controller.ts:58-72`'s `findOne`, and the planned diagnostics
guard) — not a new invention, and explicitly **not** the broader "any server
SUPPORT can see" rule flagged as **D2** in the Phase 2 contract audit.
Diagnostics does not resolve D2; it just doesn't repeat the mistake D2
flagged. If D2 is ever resolved by moving to ticket-context scoping,
Diagnostics' ownership check should be revisited to match, not left on the
older `accessEnabled` rule.

ADMIN: unrestricted, as everywhere else in this codebase.

CLIENT: **not in scope for this phase.** A client-facing "is my system
healthy" view is a legitimate future idea (it would need a much more
carefully worded, non-alarming version of the same checks), but it's a
separate product decision with its own copy/tone requirements, not a
RBAC-group toggle on this endpoint. Explicitly out of scope — do not add
CLIENT to `DIAGNOSTICS_ROLES` as a shortcut to get there.

---

## 3. API contract

```
GET /clients/:clientId/diagnostics
```

Chosen over `GET /diagnostics/client/:clientId` per the request's own
preference and rationale (Diagnostics is a projection of one Customer 360,
so it belongs under the `/clients/:id/...` namespace) — and it matches the
existing precedent: `PHASE0_PHASE1_SPEC.md` §Phase 1.5 already established
`GET /clients/:id/360` living in a *separate* `Customer360Controller` that
shares the `/clients` route prefix with `ClientsController` without
colliding (Nest allows this as long as concrete paths differ — see that
spec's note on why). `GET /clients/:clientId/diagnostics` follows the exact
same pattern: a new `DiagnosticsController` with `@Controller('clients')`,
route `:clientId/diagnostics`, no collision with `ClientsController`'s
`''`/`me`/`:id` or `Customer360Controller`'s `:id/360`.

**New module**: `backend/src/diagnostics/diagnostics.module.ts`, importing
`ClientsModule, ServersModule, TintaCoreModule, AccessModule` — same
reasoning as `Customer360Module` in `PHASE0_PHASE1_SPEC.md` §Phase 1.5 for
why this sits on top of those four rather than being folded into one of
them (avoids the same import-cycle problem). If Phase 1.5 (Customer 360)
ships first, `Customer360Service` should *call* `DiagnosticsService`
(dependency in that direction, not the reverse) — see §7.

**Ownership lives in the service, not the controller.** The controller's
only job is auth/role gating (what `RolesGuard`/`@Roles` already do) and
delegating; `DiagnosticsService.getClientDiagnostics` itself resolves
whether the specific caller may see this specific client, so the same
check applies uniformly regardless of what ends up calling it later
(Customer 360, a future Ticket-detail inline summary, anything else
internal) — an authorization rule that only exists in the HTTP controller
is exactly the kind of thing that gets silently dropped the first time a
second caller is added:

```ts
@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DiagnosticsController {
  constructor(private readonly diagnosticsService: DiagnosticsService) {}

  @Get(':clientId/diagnostics')
  @Roles(...DIAGNOSTICS_ROLES)
  async getClientDiagnostics(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClientDiagnosticsDto> {
    return this.diagnosticsService.getClientDiagnostics({
      clientId,
      requester: user,
    });
  }
}
```

```ts
// diagnostics.service.ts
async getClientDiagnostics({
  clientId,
  requester,
}: {
  clientId: string;
  requester: AuthenticatedUser;
}): Promise<ClientDiagnosticsDto> {
  await this.assertCanView(clientId, requester);
  // ... domain aggregation (§5) unchanged
}

private async assertCanView(
  clientId: string,
  requester: AuthenticatedUser,
): Promise<void> {
  if (requester.role === UserRole.ADMIN) return; // unrestricted
  if (requester.role === UserRole.SUPPORT) {
    const servers = await this.serversService.findByClientId(clientId);
    if (servers.some((s) => s.accessEnabled)) return;
    throw new ForbiddenException(
      "Access to this client's diagnostics is not currently granted",
    );
  }
  throw new ForbiddenException(); // unreachable in practice — RolesGuard
  // already rejects any role outside DIAGNOSTICS_ROLES before this runs;
  // kept as a defensive default rather than an unchecked fallthrough.
}
```

`assertCanView` is the seam D2's eventual resolution should update, in
exactly one place, whenever that decision lands — see §2.

**No request body/query params for v1** — no `?checks=agent,ha` filtering,
no `?refresh=true` force-recompute. Both are reasonable future additions
(see §9) but add complexity (partial-response shape, cache-bypass
semantics) with no current UI need driving them. Acceptance criteria (§10)
should not require them.

**Response**: `ClientDiagnosticsDto` (§1). 404 if `clientId` doesn't
resolve to a real client (reuse `ClientsService.findById`'s existing
`NotFoundException`). 403 for SUPPORT without the access gate above, or any
role outside `DIAGNOSTICS_ROLES`.

---

## 4. Freshness / TTL model

Two different kinds of "freshness" are in play and must not be conflated:

1. **`ClientDiagnosticsDto.checkedAt`** — when *this API response* was
   assembled. Always "now" (the aggregation itself is not cached across
   requests in v1 — see below for why).
2. **Each `DiagnosticCheckDto.checkedAt`** — when the *underlying data* for
   that specific check was actually captured, which varies wildly per
   check:
   - `agent`: live, if `agentOnline` (a fresh WS round-trip happened during
     this request); otherwise it's `AgentSession.lastHeartbeatAt` — could be
     seconds or days old.
   - `cloudflare`: `Server.publicCheckedAt` — updated by a cron every 2
     minutes regardless of whether anyone's looking; can be up to ~2 minutes
     stale even in the best case, exactly reflecting reality rather than
     implying live-ness the system doesn't have.
   - `homeAssistant`: same live-report round-trip as `agent` when online;
     `UNKNOWN` with no evidence when the agent itself is offline (HA
     reachability can't be probed independently of the agent's own
     WS connection in the current architecture).
   - `supportAccess`, `audit`, `resources`, `templates`, `provisioning`,
     `client`, `hub`, `server`: DB reads, effectively live (whatever's in
     Postgres right now).

**No server-side caching of the aggregate response in v1.** Every `GET
.../diagnostics` call does the live agent round-trip (when online) plus a
handful of DB reads (`client`, `hub`, `server`, `cloudflare`,
`supportAccess`, `templates`, `audit`, `provisioning` — eight checks read
from Postgres; `agent`/`homeAssistant`/`resources` share the one live
report). This is the same cost profile the *existing*
`GET /tinta-core/diagnostics/:clientId` already has today — this phase adds
parallel DB reads alongside it, not a new expensive operation class. If
support staff start hammering this endpoint (e.g., an auto-refreshing
dashboard tile) and it becomes a real load concern, add a short (~10-30s)
in-memory cache keyed by `clientId` *then* — not speculatively now. The
`checkedAt` fields already give a consumer everything needed to show
"as of X ago" without the backend needing to manage cache invalidation.

**Agent round-trip timeout**: reuses whatever timeout
`TintaAgentGateway.requestDiagnostics` already implements (it returns `report:
null` on timeout, per `getDiagnostics`'s existing doc comment) — Diagnostics
Center does not introduce a second timeout value to keep in sync with the
first.

---

## 5. The checks

Each check is produced by one pure function `(inputs) => DiagnosticCheckDto`
in `diagnostics.service.ts`, so the aggregation logic and the individual
check logic can be unit-tested independently of any HTTP/DB wiring (see
§10's test matrix — this is what makes that matrix realistic to execute).

**Governing principle for every status decision in the table below** (added
during step 3 implementation, after three genuine gaps in an earlier draft
of this table were found and closed against it — see the now-resolved
`ServerStatus.UNKNOWN`, `supportAccess`'s "open with time to spare", and
`provisioning`'s "no connection, no token data" rows):

```
UNKNOWN = insufficient evidence to call the state anything else
ERROR   = evidence of an actual failure
WARNING = evidence of a degraded / attention-needed state
OK      = evidence sufficient to call the state healthy
```

Concretely: an enum member, a missing row, or a data combination the table
doesn't explicitly name is a defect in this table, not license to guess —
every check's table row must be exhaustive over its actual input domain
(including every real enum value, not just the ones a first draft happened
to mention) before it's implemented. `UNKNOWN` is the correct default for
"the table doesn't say" precisely because it means "insufficient evidence,"
never "we didn't think about this."

| key | Source (existing code) | OK | WARNING | ERROR | UNKNOWN |
|---|---|---|---|---|---|
| `client` | `Client`/`User` entities (already fetched to resolve `clientId` at all) | `user.isActive` | — | `!user.isActive` (`CLIENT_INACTIVE`) | never — if we got this far the client resolved |
| `hub` | `Server.hubId` presence | hub linked | — | client has a server but `hubId` is null (`HUB_NOT_LINKED`) | client has zero servers (`NO_SERVER`) — this is UNKNOWN, not ERROR: a brand-new client mid-provisioning legitimately has no server yet, that's not a fault |
| `server` | `Server.status`, `Server.accessEnabled` | `status === ONLINE` | `status === OFFLINE` but `lastSeenAt` within 24h (`SERVER_RECENTLY_OFFLINE`) | `status === OFFLINE` and `lastSeenAt` older than 24h or null (`SERVER_OFFLINE`) | no server (see `hub` row — same condition, don't double-report as two ERRORs); **or `status === ServerStatus.UNKNOWN`** (`SERVER_STATUS_UNKNOWN`) — `ServerStatus` has three members, not two; an unconfirmed status is unconfirmed, not evidence of a fault, so it must not be ERROR |
| `agent` | `TintaCoreService.getDiagnostics()` (§0 item 7) + `AgentSession.lastHeartbeatAt`/`.status` | `agentOnline: true` | `agentOnline: true` but `report === null` (answered nothing within timeout — `AGENT_UNRESPONSIVE`) | `agentOnline: false` (`AGENT_OFFLINE`) | no `AgentSession` row exists at all for this client (not yet provisioned — `AGENT_NOT_PROVISIONED`) |
| `homeAssistant` | `report.haConnected` (only when `agent` check has a live report) | `report.haConnected === true` | — | `report.haConnected === false` (`HA_API_UNAVAILABLE`) | agent offline or no report (§0 item 4 already covers why this can't be probed independently) |
| `cloudflare` | `Server.publicStatus`/`publicCheckedAt` (§0 item 1 — **not** a Cloudflare API call) | `REACHABLE` | — | `UNREACHABLE` (`PUBLIC_URL_UNREACHABLE`) | `UNKNOWN` (never probed yet, or the `publicUrl`/`subdomain` isn't set) — passthrough of the entity's own 3-state enum, not reinterpreted |
| `supportAccess` | `Server.accessEnabled`/`accessExpiresAt`, active `AccessLog` (via `AccessService.getActiveAccessForServer`) | `accessEnabled: false` (closed, as expected — this is the healthy default state); **or `accessEnabled: true` + active `AccessLog` + `accessExpiresAt` more than 15 min out** — an open grant with time to spare is healthy, not merely "not yet a problem" | `accessEnabled: true` + active `AccessLog` + `accessExpiresAt` within 15 min (`ACCESS_EXPIRING_SOON`) | never — an open access grant isn't a fault | `accessEnabled: true`, no active `AccessLog` row found (data inconsistency — flag it as UNKNOWN, not silently OK, since the invariant "accessEnabled implies an active grant" should always hold); **or `accessEnabled: true` + active `AccessLog` + `accessExpiresAt === null`** — confirmed against `AccessService.grantAccess` (`access.service.ts:100-126`): every real grant computes a concrete `expiresAt`, there is no indefinite-grant code path, so a null `accessExpiresAt` on an "active" log is itself an invariant violation, same category as the missing-log case, not a distinct third meaning |
| `resources` | `report.{cpu,mem,disk}Percent` (live only — §0 item 4, no fallback to stale `metrics` for these three) | all three < 80% | any one ≥ 80% (`RESOURCE_HIGH_USAGE`, name the specific resource in `message`) | any one ≥ 95% (`RESOURCE_CRITICAL`) | agent offline / no report |
| `templates` | `AgentSession.appliedTemplates` vs `GoldenTemplateService.findAll()` | every slug `findAll()` currently returns is present in `appliedTemplates` | some missing (`TEMPLATES_PENDING` — normal right after provisioning, before the agent's next connect applies them) | never — a missing template is an expected transient state, not a fault | no `AgentSession` |
| `audit` | This client's own `AccessLog` count (§0 item 3 — **not** `verifyChain()`) | `eventCount > 0` | — | never (v1 doesn't attempt anomaly detection here) | `eventCount === 0` (new client, nothing to audit yet) |
| `provisioning` | `AgentSession.installTokenExpiresAt`/`lastConnectedAt` (§0 item 2 — derived, not a real state machine yet; `serviceStartConsentAt` is evidence only, see §0 item 2) | `lastConnectedAt` is set (agent has connected at least once, ever) | install token still valid but agent has never connected (`INSTALL_PENDING`) | install token expired and agent has never connected (`INSTALL_EXPIRED`) | no `AgentSession` (not provisioned); **or `AgentSession` exists, `lastConnectedAt === null`, AND `installTokenExpiresAt === null`** (`PROVISIONING_STATE_UNKNOWN`) — no connection and no token data means valid/expired genuinely cannot be determined; this must not be read as ERROR, since that would assert a failure the data doesn't actually show |

**`templates`'s "active templates" defined precisely**: `GoldenTemplate` has
no `isDefault` column (confirmed against `tinta-core/entities/golden-
template.entity.ts` — the only relevant flag is `isActive`).
`GoldenTemplateService.findAll()` already filters `where: { isActive: true }`
(`golden-template.service.ts`), and `tinta-agent.gateway.ts`'s own comment
calls exactly this set "default golden templates" when auto-applying them
post-connect. So "active default templates" in this spec means precisely
"whatever `GoldenTemplateService.findAll()` returns right now" — not a
separate concept an implementer needs to invent a new filter for.

**`supportAccess` describes the current access state; it is not a health
assertion.** `accessEnabled: false` mapping to `OK` reflects that support
access is opt-in and closed-by-default — it is not evidence of a healthy
system, just the expected steady state. **Do not "fix" this later by making
`accessEnabled: false` a `WARNING`** on the theory that "nothing is
open" sounds like it should be neutral-at-worst; closed access is the
*good* state here, exactly as specified. Note also the practical
consequence of the RBAC rule in §2: SUPPORT can only reach this endpoint
when `accessEnabled: true` on at least one server, so a SUPPORT caller will
essentially never observe `supportAccess: OK` (closed) for the server that
granted them access — only ADMIN routinely sees that value. This is
expected, not a bug to chase.

**Representative server selection is deterministic, not "TBD"**: see §7 —
this section previously left the multi-server tie-break undecided, which
is now fixed to `ORDER BY createdAt ASC, id ASC` with a `multiServerDetected`
evidence flag on the `server` check.

**`evidence` is an allowlisted projection — never a spread.** Every check's
evidence object must be built field-by-field from named source values
(`{ publicStatus: server.publicStatus, publicCheckedAt: server.publicCheckedAt }`),
never by spreading an entity, DTO, or raw service result
(`{ ...server }` is forbidden, full stop) — `Record<string, unknown>`'s
looser typing (§1) makes this an easy accident to introduce later without a
compiler catching it, which is exactly the failure mode that has already
leaked real secrets in this codebase (`test/helpers/assert-no-forbidden-
keys.ts`'s own header comment cites two prior production incidents of this
shape). `assertNoForbiddenKeys(response.body, STAFF_FORBIDDEN_KEYS)` in the
e2e suite (§10) is the regression backstop for this rule, not a substitute
for following it when writing each check.

Three deliberate cross-check consistency rules, all already implied above
but worth stating explicitly since they're easy to get wrong independently
per check:
- `hub`/`server`'s "no server" case and `agent`'s "not provisioned" case can
  legitimately both be true for the same brand-new client — don't let one
  check's absence-of-data cascade into a misleading ERROR on an unrelated
  check.
- `homeAssistant` must never show a status when `agent` is anything but
  `OK`/`WARNING` (i.e., `agentOnline: true`) — its evidence should be `null`
  and status `UNKNOWN` whenever the agent itself didn't answer, never
  "inherit" the agent's ERROR as its own separate ERROR (that would double-
  count one real problem as two red checks).
- **General principle, applying to the whole table, not just the
  `agent`→`homeAssistant` case above**: a check may depend on another
  check's *data* only when the dependency represents an actual
  observability limitation (as `homeAssistant` genuinely cannot be probed
  without the agent being online) — it must never copy or escalate the
  upstream check's failure just because they're related. Each of the 11
  rows in the table above is computed independently from its own inputs;
  only `aggregateStatus` (§1) combines them, and only by taking the worst
  status, never by propagating one check's specific code/message into
  another's.

### Evidence field lists (per check, for the `Record<string, unknown>` from §1)

- `agent`: `{ lastConnectedAt, lastHeartbeatAt, agentVersion, connectionState: 'connected'|'disconnected' }`
- `homeAssistant`: `{ haVersion, haConnected }`
- `cloudflare`: `{ publicStatus, publicCheckedAt, publicUrl }`
- `supportAccess`: `{ accessEnabled, accessExpiresAt, activeSince: connectedAt|null }`
- `resources`: `{ cpuPercent, memPercent, diskPercent }`, plus
  `affectedResources: { resource: 'cpu'|'memory'|'disk'; percent: number }[]`
  on `RESOURCE_HIGH_USAGE`/`RESOURCE_CRITICAL` only (added 2026-09-22 for
  frontend i18n of the dynamic message text — `resource` is a stable
  identifier, kept separate from the English `message`'s own wording, so
  the frontend never has to re-derive which readings crossed which
  threshold to translate the sentence)
- `templates`: `{ appliedTemplates, pendingTemplates: string[] }`
- `audit`: `{ lastEventAt, eventCount }`
- `provisioning`: `{ installTokenExpiresAt, serviceStartConsentAt, lastConnectedAt }`
  — `serviceStartConsentAt` appears here as evidence even though it doesn't
  drive the status (§0 item 2).
- `client`, `hub`: `{ }` or a small 1-2 field subset of the table above's own
  trigger condition — the least interesting evidence-wise, since the DTO's
  own top-level `client`/`hub` summary objects (§1) already carry the
  relevant identifiers.
- `server`: `{ multiServerDetected: boolean }` (§7) plus a small subset of
  its trigger condition, same rationale as `client`/`hub` above.

---

## 6. Status semantics for the frontend (information architecture)

Four-color model, not three — this is a repeated point in the request and
has a concrete UI consequence: **`UNKNOWN` needs its own visual treatment**,
distinct from both `OK` (green) and `WARNING`/`ERROR` (amber/red). Recommend
a neutral gray/outline treatment with a "not yet checked" or "no data"
connotation, never rendered with any shade that reads as "something's
wrong" at a glance. This mirrors the existing `PublicStatusBadge` pattern
(`frontend/src/app/dashboard/client/page.tsx` — already has a 3-state
reachable/unreachable/unknown badge with exactly this "unknown is neutral,
not alarming" treatment) — reuse that component's color logic rather than
inventing a second convention.

**Page structure** (`/dashboard/diagnostics/[clientId]`, staff-only,
`canViewDiagnostics` from `frontend/src/lib/permissions.ts` — already
exists, unused, per the Phase 2 audit):
- Header: client name, `overallStatus` badge, `checkedAt` ("as of just now" /
  relative time).
- A fixed-order checklist of all entries in `checks[]` (never conditionally
  hidden — an `UNKNOWN` row for "no server yet" is itself useful
  information, not noise to filter out).
- Each row: status badge, `title`, `message`; expandable to show `evidence`
  as a simple key/value list (mirrors the existing `AccessLogDetailsDrawer`
  expand-to-see-raw-detail pattern).
- No polling/auto-refresh in v1 (see §4 — no caching means no cheap way to
  auto-refresh without extra load; a manual refresh button is enough for a
  first cut).

**Entry points**: linked from `HubDrawer` (replacing the ad hoc
`checkDiagnostics` state per `PHASE0_PHASE1_SPEC.md` §Phase 1.3's existing
plan — unchanged by this document) and, once it exists, from Customer 360
(§7) and the Ticket detail page (§8).

---

## 7. Relationship to Customer 360 (Phase 1.5)

Customer 360's `Customer360View` (`PHASE0_PHASE1_SPEC.md` §Phase 1.5) is a
**separate, broader aggregation** (profile + servers + tickets +
accessHistory) that does not itself compute diagnostic *status* — it lists
raw facts. The relationship should be: `Customer360Service` calls
`DiagnosticsService.getClientDiagnostics(clientId)` and embeds the result
verbatim as one field (`diagnostics: ClientDiagnosticsDto`) rather than
duplicating any of the check logic. This means Diagnostics Center (this
phase) should ship *before* Customer 360 consumes it, which matches the
already-agreed ordering (Diagnostics → Provisioning → Customer 360).

**Multi-server clients — v1 assumption and deterministic fallback.**
`PHASE0_PHASE1_SPEC.md`'s data model allows one client to have multiple
servers (§Phase 1.4's HIGH finding is specifically about this), but no real
multi-server client exists in current seed/production data to design a full
multi-server Diagnostics view against yet. **V1 assumption: a client has at
most one server.** If a query ever finds more than one (it shouldn't today,
but the query must not silently assume otherwise), `ClientDiagnosticsDto`
picks its representative server via one fixed, deterministic rule — **`ORDER
BY createdAt ASC, id ASC`, take the first row** (oldest server, `id` as a
pure tie-break for two rows with an identical timestamp) — never "whichever
one has `accessEnabled`" or any other condition-dependent selection, which
would make the *same* client's Diagnostics silently point at a *different*
server from one call to the next as access state changes. The `server`
check's evidence (§5) includes `multiServerDetected: true` whenever this
tie-break actually had more than one candidate to choose from, so a
multi-server client's Diagnostics visibly says "there's more here" instead
of quietly reporting on only one of several servers with no indication
anything was left out. A client with N servers conceptually needs N
independent diagnostic reports, one per server — full multi-server
Diagnostics (e.g. a `?serverId=` param, or an array of per-server reports)
is deliberately not built in v1; revisit if/when a multi-server client
actually shows up in practice.

---

## 8. Relationship to Tickets (Phase 1.6 / future)

Not built in this phase — `PHASE0_PHASE1_SPEC.md` §Phase 1.6 (ticket
linkage) doesn't mention diagnostics at all, and the request's own §9 example
("Ticket #1042 ... Agent: ONLINE, HA: ERROR ...") is explicitly framed as
"the next level" after Diagnostics + Customer 360 exist. Once a ticket is
linked to a client+server (Phase 1.6), the natural integration is: the
ticket detail page fetches `GET /clients/:clientId/diagnostics` for the
linked client and renders a compact summary (not the full checklist) inline
— reusing this endpoint and DTO as-is, no ticket-specific diagnostics
variant. No "diagnostics snapshot frozen at ticket-creation-time" concept in
v1 either — always live, same freshness model as §4. If a historical
snapshot ever becomes a real need (e.g., "what did diagnostics show when
this ticket was opened"), that's a new, explicit feature (store a
`DiagnosticsSnapshot` row), not an implicit side effect of viewing the
endpoint — don't build silent snapshotting speculatively now.

---

## 9. Explicitly out of scope for v1 (forward-compat seams, not gaps)

- Query-param check filtering / force-refresh (§3).
- Server-side response caching (§4) — until real load data says otherwise.
- Multi-server-aware diagnostics (§7).
- CLIENT-facing diagnostics view (§2).
- Historical diagnostics snapshots tied to tickets (§8).
- A typed discriminated union for `evidence` instead of `Record<string,
  unknown>` (§1) — revisit once the per-check shapes stabilize.
- ~~Extracting `OFFLINE_THRESHOLD_MS`~~ — **moved out of "out of scope": this
  is now a mandatory acceptance-criteria item, §10 and §11 step 1.** Kept as
  a struck-through entry here only so a reader skimming this section doesn't
  mistake its absence for an oversight.
- Resolving **D1** (`GET /install/:token`) or **D2** (SUPPORT access-log
  scope) — both stay open, tracked separately, exactly as the Phase 2
  contract audit left them. Diagnostics' own SUPPORT ownership check (§2)
  reuses the *existing* `accessEnabled` pattern precisely so it doesn't
  quietly pre-empt D2's resolution by picking a stance on it.

---

## 10. Acceptance criteria / test matrix

**Mandatory prerequisite, not optional cleanup**: `OFFLINE_THRESHOLD_MS`
(§0 item 5) extracted to a shared constant and imported by both
`AgentMonitorScheduler` and `DiagnosticsService` — a PR that hardcodes a
second `5 * 60 * 1000` (or any other value) in the Diagnostics code instead
of importing the existing constant does not meet acceptance for this phase.

Per-check unit tests (no DB, no HTTP — pure function tests per §5's design
goal):
- Each of the **11** checks in §5: one test per status transition it can
  reach (e.g. `agent`: online-with-report → OK, online-no-report →
  WARNING, offline → ERROR, no-session → UNKNOWN — 4 tests for that one
  check alone).
- Aggregation rule (§1): the `[OK]` / `[UNKNOWN]` / `[WARNING, UNKNOWN]` /
  `[ERROR, UNKNOWN×4]` table from §1, verbatim.
- Independence principle (§5): a targeted test that an `agent: ERROR`
  input does *not* change `server`'s or `hub`'s computed status — i.e. each
  check function genuinely ignores the others' outputs.

E2E (real HTTP, real DB — extends the current 7-endpoint e2e coverage
identified in the Phase 2 contract audit):
- ADMIN: `GET /clients/:id/diagnostics` for a fully-provisioned, healthy
  seed client → 200, `overallStatus: OK`, `checks.length === 11`.
- ADMIN: same for a client with zero servers → 200, `overallStatus: UNKNOWN`
  (not ERROR — the explicit rule from §1), `hub`/`server`/`agent` checks all
  UNKNOWN with `NO_SERVER`/`AGENT_NOT_PROVISIONED` codes.
- **ADMIN, agent online but unresponsive** (`agentOnline: true, report:
  null`, e.g. via a test double on `TintaAgentGateway.requestDiagnostics`):
  `agent` → WARNING (`AGENT_UNRESPONSIVE`), `homeAssistant` → UNKNOWN,
  `resources` → UNKNOWN — the exact boundary §5's independence principle
  and §0 item 4's live/stale resolution both depend on.
- **ADMIN, `Server.publicStatus` variations**: seed a server at
  `UNKNOWN` → `cloudflare` check reports `UNKNOWN`; seed one at
  `UNREACHABLE` → `cloudflare` reports `ERROR`
  (`PUBLIC_URL_UNREACHABLE`) — directly exercises the §0 item 1 correction
  (this check is a passthrough of the probe's own 3-state enum, not a
  reinterpretation of it).
- SUPPORT with `accessEnabled` on one of the client's servers → 200.
- SUPPORT without any `accessEnabled` server for that client → 403.
- CLIENT role → 403 (not in `DIAGNOSTICS_ROLES`).
- Nonexistent `clientId` → 404.
- `assertNoForbiddenKeys(response.body, STAFF_FORBIDDEN_KEYS)` — reuse the
  existing security-regression helper (`test/helpers/assert-no-forbidden-
  keys.ts`) rather than trusting that DTO field selection alone prevents a
  future regression; this endpoint touches `AgentSession`/`Server`/`Client`
  data that has previously leaked secrets in this exact codebase. This is
  the backstop for §5's "evidence is an allowlisted projection, never a
  spread" rule, not a substitute for following it.

OpenAPI/generated-contract gate (matches the established `api:check`
pipeline from `64dcf5b`): after implementation, regenerate against a live
instance and confirm `ClientDiagnosticsDto`/`DiagnosticCheckDto` appear with
real `properties`, `DiagnosticStatus` gets `enumName`, and
`GET /clients/{clientId}/diagnostics`'s response references the DTO by
`$ref` — not an empty/untyped schema, per the same verification method used
for every Phase 2C endpoint.

---

## 11. Sequencing within this phase

```
1. Extract OFFLINE_THRESHOLD_MS (§0 item 5) to a shared constant, update
   AgentMonitorScheduler to import it — mandatory acceptance-criteria item,
   done first so step 2's Agent check has it available from the start
   rather than reintroducing a second literal 5*60*1000 to reconcile later
2. DiagnosticStatus enum + DiagnosticCheckDto + ClientDiagnosticsDto (types only)
3. Per-check pure functions in diagnostics.service.ts, unit-tested against
   hand-built fixture inputs (no DB) — this is most of the actual logic and
   the safest place to get the OK/WARNING/ERROR/UNKNOWN boundaries right
   before wiring anything real
4. DiagnosticsModule + DiagnosticsController + assertCanView (§3) + real
   data wiring (DB reads, TintaCoreService.getDiagnostics call)
5. E2E tests per §10
6. OpenAPI regeneration + api:check verification
7. Frontend: generated types → /dashboard/diagnostics/[clientId] page
8. HubDrawer's ad hoc checkDiagnostics/live-metrics removal, replaced with a
   link out (already-agreed scope from PHASE0_PHASE1_SPEC.md §Phase 1.3 —
   unchanged, just finally executed)
```

Each numbered step above is a natural atomic-commit boundary, consistent
with how every prior domain in this project has been decomposed — this
phase should not become one large commit just because it's "a vertical
slice."
