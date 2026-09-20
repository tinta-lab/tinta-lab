# Phase 1.4 — Provisioning Reliability Spec

Status: **DRAFT v2.5 — awaiting review.** Nothing in this document is implemented.
Sections marked **PROPOSED** contain a concrete recommendation but represent a
design decision that has not yet been confirmed and may be corrected before
implementation starts. Sections without that marker restate settled
decisions and are not open for silent reinterpretation.

**Revision history:**
- v1 (2026-09-20): first draft. One `ProvisioningState` enum, including a
  `SERVER_DEGRADED` state that mixed lifecycle, resource health, and
  infrastructure connectivity.
- v2 (2026-09-20): split into three concepts (§3.0), removed `SERVER_DEGRADED`.
  **Correction note:** a message presenting v2 described several additions
  as already written to this file when they were not — noted rather than
  silently fixed, since claiming unverified work as done is exactly the
  failure mode this project's verification discipline exists to prevent.
- v2.1 (2026-09-20): the additions from v2's description, now actually
  written, plus an 8-point follow-up: operation-vs-lifecycle completion
  semantics (§5.6), crash-recovery step tracking (§6.1, `lastCompletedStep`),
  deterministic multi-server/operation binding (§4.1, `serverId`),
  READY-write atomicity (§3.2.2), Cloudflare Case B determinism (§7),
  migration backfill correctness (§20), FAILED terminality, and one
  additional acceptance test.
- v2.2 (2026-09-20): **P0 fix.** v2.1 claimed `ProvisioningState` "lives on
  AgentSession," but its enum still contained `CREATED` and
  `PROVISIONING_SERVER` — both of which occur *before* `AgentSession` exists
  (per §1's flow, `AgentSession` is only created after `Server` creation).
  There was no field to hold those two values. Worse, every failure reason
  in §16 (`DUPLICATE_EMAIL`, `SUBDOMAIN_TAKEN`, `AGENT_SESSION_FAILED`) also
  occurs before `AgentSession` exists, so `FAILED` had the same problem.
  Resolution (Option B, as recommended in review): `ProvisioningState` is
  now a 4-value enum (`AWAITING_INSTALL`/`INSTALL_CONSENTED`/
  `INSTALL_EXPIRED`/`READY`) that only comes into existence at the moment
  `AgentSession` is created — its first value is always `AWAITING_INSTALL`.
  `CREATED` and `PROVISIONING_SERVER` are removed as lifecycle states;
  their work is already fully covered by `ProvisioningOperation.lastCompletedStep`'s
  existing `RESOLVE_CLIENT`/`ENSURE_SERVER` values (§6.1) — no new concept
  was needed, only removal of the duplicate, homeless one.
  `FAILED` moves entirely to `ProvisioningOperation.status` (§6.1's
  `failureCode`/`failureMessage` already existed for exactly this). This
  ripples into §3.1, §4, §6.1, §8, §16, §19, §20, §21, §22.
- v2.3 (2026-09-20): **two more P0s, found by tracing §5–§6 and §3–§4
  against each other as one model rather than section-by-section.**
  (1) §5.2 said a `FAILED` operation is retried by "starting a NEW
  operation," but §5.4's unique index on `(principalUserId, idempotencyKey)`
  makes a second row for the same key un-insertable — the two sections
  described mechanisms that couldn't both be true at once. Fixed: a retry
  with the same key now reopens the *same* `operationId`
  (`FAILED → IN_PROGRESS` via a conditional `ON CONFLICT ... DO UPDATE ...
  WHERE status = 'FAILED'`, §5.4), never a new one; only a retry with no
  key at all gets a genuinely new `operationId`. (2) §3.1 defined
  `AWAITING_INSTALL` as requiring "consent not yet recorded," but §4 sent
  *every* `INSTALL_EXPIRED` retry there unconditionally — including a
  client who had already reached `INSTALL_CONSENTED` before their token
  happened to expire, whose `serviceStartConsentAt` (write-once per §9) is
  never cleared. That client would land in a state whose own definition
  they contradict. Fixed: the retry now branches on
  `serviceStartConsentAt` — `AWAITING_INSTALL` if still null, else
  `INSTALL_CONSENTED` — never destroying already-recorded consent. Also
  added: an explicit write-order definition for the `COMPLETE` step (§5.6),
  so `ProvisioningOperation.status = SUCCEEDED` can never be observed
  without its `cachedResult` already present.
- v2.4 (2026-09-20): **one more P0.** v2.3's `FAILED`-reopen fix guarded the
  atomic `ON CONFLICT ... DO UPDATE` only on `status = 'FAILED'`, not on
  `request_fingerprint` matching. That meant a retry carrying a
  *different* fingerprint than the original could still flip a `FAILED`
  row to `IN_PROGRESS` inside the database, before any application-level
  fingerprint check ran — silently defeating §5.2's "different fingerprint
  → 409, zero side effects" guarantee for exactly the case (a genuinely
  failed, reopenable operation) where it mattered most. Fixed: the
  `DO UPDATE ... WHERE` clause (§5.4) now also requires
  `request_fingerprint = EXCLUDED.request_fingerprint`, so the fingerprint
  comparison that decides whether a reopen is legitimate happens inside
  the same atomic statement as the reopen itself, never as a separate,
  raceable, after-the-fact step. §5.2 cross-references this explicitly.
- v2.5 (2026-09-20): **no new architectural change — a full top-to-bottom
  read of the document (not section-by-section) surfaced three places that
  v2.3/v2.4's "reopen the same operation" fix hadn't propagated to, each
  still describing the old, now-superseded "retry always starts a new
  ProvisioningOperation" behavior: §4's failure/retry note, §15's `FAILED`
  retry rule, and §21's `POST /provisioning/:clientId/retry` endpoint
  description. All three corrected to the same-key-reopens/no-key-creates-new
  rule already established in §5.2/§5.4/§6.4. Also found and fixed:
  §16's `SUBDOMAIN_TAKEN` entry incorrectly attributed its race condition
  to §5.4's `(principalUserId, idempotencyKey)` claim mechanism — that
  mechanism cannot be involved, since the actual race is between two
  concurrent operations with *no shared Idempotency-Key* (§5.4 never
  activates for either), colliding instead on the `Server.subdomain`
  database-level unique constraint. Corrected to name the real mechanism.

Framing, as agreed: this phase does **not** aim to "build a provisioning state
machine" for its own sake. The goal is —

> Make provisioning repeatable, recoverable, and observable, without
> duplicating infrastructure and without destructive re-provisioning.

---

## 0. Source material

Every claim about current behavior in this document is grounded in the
Phase 1.4 read-only audit conducted 2026-09-20 against
`/home/tinta/tinta-lab/backend/src` at commit `9e1444d`. File:line citations
below refer to that audit unless noted otherwise. Nothing here should be
taken as already fixed — this document describes the **current** system and
then proposes changes; the two are kept visually distinct throughout.

---

## 1. Current provisioning flow (as-is, no proposed changes)

`POST /provisioning/client` (`provisioning.controller.ts:17-23`, ADMIN-only,
20/hour) → `ProvisioningService.provisionClient()` (`provisioning.service.ts:71-206`):

1. **Resolve/create Client+User** (`provisioning.service.ts:76-116`) — dedups
   by `existingClientId` or by email via `UsersService.findByEmail`
   (`users.service.ts:59-61`); a genuine duplicate email is mapped to
   `ConflictException` (`provisioning.service.ts:109-114`).
2. **Create Server** (`servers.service.ts:41-98`) — generates `hubId`
   (`cloudflare.service.ts:14-17`), inserts the `servers` row
   (`servers.service.ts:51-61`), then best-effort provisions a Cloudflare
   tunnel (`cloudflare.service.ts:63-126`). **Any Cloudflare failure is
   caught and logged only** (`servers.service.ts:89-94`) — the `Server` row
   is left permanently with `tunnelToken: null`.
3. **Create/rotate AgentSession** (`tinta-core.service.ts:66-106`) — mints a
   365-day `agentToken` JWT and a 48h single-use `installToken`. **If an
   `AgentSession` already exists for this client, both tokens are
   unconditionally rotated and any live agent socket is force-disconnected**
   (`tinta-core.service.ts:86-99`, `tinta-agent.gateway.ts:286-294`) — this
   fires on *every* repeat call, including one against an already-`READY`,
   currently-connected client.
4. **Best-effort default golden templates** (`provisioning.service.ts:144-154`)
   — silently swallowed with an empty `.catch(() => {})`
   (`provisioning.service.ts:148-153`); a no-op in practice since the agent
   isn't connected yet.
5. **Telegram notify** (`notifications.service.ts:52-82`) — no DB writes.
6. **Response** — `ProvisionResultDto` with the install URL and raw secrets.

Downstream: `GET /install/:token` (public, throttled, consent-gated) consumes
the install token exactly once (`tinta-core.service.ts:158-163`,
`provisioning.service.ts:249-252`); the Agent's WebSocket `register`
(`tinta-agent.gateway.ts:106-239`) validates the JWT against the stored
`agentToken`, marks the session `CONNECTED`, and re-applies any unapplied
templates.

There is **no Home Assistant discovery/pairing code in this backend at all**
— that responsibility belongs entirely to the Tinta Agent process, which is
out of this repo. This spec does not invent backend state for it.

A second, narrower endpoint already exists for credential rotation alone:
`POST /tinta-core/provision/:clientId` (`tinta-core.controller.ts:26-30`,
ADMIN-only) calls `TintaCoreService.provisionAgent()` directly, without
touching `Client`/`Server`/Cloudflare. This matters for §5 below.

No transaction wraps any part of this flow (confirmed: `transaction`/
`queryRunner` usage in this backend exists only in `access/audit-log.service.ts`,
which is unrelated). No reconciliation runs on backend startup.

---

## 2. Scope / non-scope

| Finding | Disposition | Phase 1.4 action |
|---|---|---|
| Repeat `POST /provisioning/client` creates duplicate Server/tunnel | **FIX** | Mandatory idempotency, enforced inside the domain service (§5) |
| No transaction / no recovery from partial state | **FIX** | State machine + recovery (§3, §6) — not one cross-system DB transaction (§7) |
| `AgentSession.status` stale up to 5 min after backend restart | **FIX** | Startup reconciliation, scoped to provisioning only (§14) |
| `Client.isInstalled` dead field | **FIX** | Resolve ambiguity — derived compatibility field over the real state (§13) |
| Template applied without delivery ACK | **PARTIAL / CONTRACT** | Backend prepares a delivery-state contract; a real ACK needs Agent-repo changes and is designed, not implemented, here (§12) |
| Silent `.catch(() => {})` on template application | **FIX** | Classify + log expected-vs-unexpected failures (§12) |
| Concurrent WebSocket registration for one client | **OUT OF SCOPE** | Belongs to P2.3 Agent WS lifecycle |
| No HA discovery/pairing in backend | **OUT OF SCOPE** | Boundary confirmed: Agent's responsibility, not modeled here |

Also explicitly out of scope for Phase 1.4: full Agent-repo implementation,
D1 (`GET /install/:token` exposure model), D2 (SUPPORT access scoping),
Customer 360, ticket linkage. See §23 for the complete list.

---

## 3. Provisioning model — **PROPOSED, three separate concepts**

### 3.0 The three concepts

```
ProvisioningState     — client-level, monotonic lifecycle stage.
                        "How far along is this client's install."
                        Lives on AgentSession (§8) — and therefore only
                        EXISTS once AgentSession does. Before that,
                        there is no ProvisioningState value at all for
                        a client; "not yet provisioned" is expressed by
                        the absence of an AgentSession row, not by a
                        ProvisioningState value (§3.1 explains why this
                        matters and what changed because of it).
                        Never regresses once it exists, with exactly one
                        named, consent-aware exception —
                        INSTALL_EXPIRED → AWAITING_INSTALL or
                        INSTALL_CONSENTED, depending on whether
                        serviceStartConsentAt was already recorded before
                        the token expired — which §3.1 states as an
                        explicit, bounded carve-out rather than leaving it
                        as an implicit contradiction of "never regresses."

ProvisioningOperation — one execution/attempt of provisionClient().
                        "What happened when this was called." Completes
                        (SUCCEEDED/FAILED) when the provisioning API call
                        itself finishes preparing resources — see §5.6 for
                        the precise boundary, which is deliberately NOT the
                        same event as reaching READY. Everything that
                        happens BEFORE AgentSession exists — resolving the
                        Client, creating the Server, reconciling Cloudflare
                        — is tracked here, as lastCompletedStep values
                        (§6.1), not as ProvisioningState.

Resource/Health evidence — infrastructure-level facts (does this Server
                        have a working Cloudflare tunnel right now). Lives
                        on Server (§3.3). Owned and surfaced by
                        Diagnostics, which already has a dedicated check
                        for this and already established
                        (PHASE1_3_DIAGNOSTICS_SPEC.md §0) that "checks must
                        not cascade."
```

**Hard rule (governing, not advisory):** `Server.status`, `Server.publicStatus`,
`cloudflareProvisioningStatus`, `AgentStatus` (`AgentSession.status`), and
`templateDeliveryStatus` (§3.2.1) are never `ProvisioningState`, are never
read by the code that computes `ProvisioningState`, and never gate a
`ProvisioningState` transition. If a future change needs one of them to
influence provisioning lifecycle, that is itself a spec amendment requiring
the same review this document went through. This rule exists specifically
to prevent the reappearance of a hidden, informally-mixed state machine of
the kind `SERVER_DEGRADED` was in v1.

### 3.1 `ProvisioningState` enum — **only exists from `AgentSession` creation onward**

v2.1 listed `CREATED` and `PROVISIONING_SERVER` as `ProvisioningState`
values while also stating the field "lives on `AgentSession`." Per the
audit's own flow (§1), `AgentSession` is created only *after* `Server`
creation — so at the moment a client would be `CREATED` or
`PROVISIONING_SERVER`, there is no row to store that value in. This was a
real modeling error, not a wording issue: it meant `ProvisioningState` and
`ProvisioningOperation.lastCompletedStep` (§6.1) were two competing axes for
the same early phase of work, with the first one physically unimplementable.

**Resolution:** `ProvisioningState` is retired as a concept until
`AgentSession` exists. Everything before that point — resolving the Client,
creating the Server, reconciling Cloudflare — is `ProvisioningOperation`
progress only, already fully expressed by `lastCompletedStep`'s existing
`RESOLVE_CLIENT`/`ENSURE_SERVER`/`RECONCILE_CLOUDFLARE` values (§6.1). No
new concept was needed to close this gap — only removing the duplicate,
homeless one.

```
AWAITING_INSTALL     → AgentSession just created (this is the FIRST value
                        ProvisioningState ever takes for a client —
                        assigned in the same insert that creates the row).
                        installToken valid, agent has never connected,
                        consent not yet recorded.
INSTALL_CONSENTED    → Same as above, but serviceStartConsentAt is set.
INSTALL_EXPIRED      → installToken expired before any connection.
READY                → formally defined in §3.2.
```

**`FAILED` is not a `ProvisioningState` value.** Every failure reason
enumerated in §16 (`DUPLICATE_EMAIL`, `SUBDOMAIN_TAKEN`,
`AGENT_SESSION_FAILED`) occurs during Client resolution, Server creation, or
AgentSession creation itself — i.e. before `AgentSession` successfully
exists to hold any state at all. `FAILED` is exclusively a
`ProvisioningOperation.status` value (§6.1) — see §6.4 for what this means
for retries. If `AgentSession` was never created, there is no
`ProvisioningState` for that client at all; "was there a failed attempt" is
answered by looking at `ProvisioningOperation`/`provisioning_events` history
for that email/`clientId`, not by a client-level state value. This is
consistent with today's Diagnostics behavior, which already treats "no
session exists" (`hasSession: false`) as its own case (§19).

**`INSTALL_EXPIRED → AWAITING_INSTALL`/`INSTALL_CONSENTED` is the one named,
bounded exception to "never regresses."** Stated explicitly rather than left
as an implicit contradiction: `INSTALL_EXPIRED` is terminal for the
*current install attempt* — the specific `installToken` that expired is
dead and unrecoverable — but it is not terminal for the client's overall
lifecycle. Reissuing an install token (§4's `INSTALL_EXPIRED | provision
retried` row) starts a **new** install attempt.

**This retry is consent-aware, not a blind reset to `AWAITING_INSTALL`.**
`AWAITING_INSTALL`'s own definition (above) requires "consent not yet
recorded" — reissuing a token can only land there if that is still true. If
the client had already reached `INSTALL_CONSENTED` before their token
expired (a real, reachable sequence: `AWAITING_INSTALL` → consent recorded →
`INSTALL_CONSENTED` → token TTL elapses before the agent ever connects →
`INSTALL_EXPIRED`), a retry must **not** send them back to
`AWAITING_INSTALL` — `serviceStartConsentAt` is a write-once §356 BGB legal
timestamp (§9) that is never cleared, so a client in that position still
genuinely has consent on record, and `AWAITING_INSTALL`'s "consent not yet
recorded" invariant would be false for them. The retry branches instead:

```
INSTALL_EXPIRED, retry (new installToken minted either way)
    ├── serviceStartConsentAt IS NULL     → AWAITING_INSTALL
    └── serviceStartConsentAt IS NOT NULL → INSTALL_CONSENTED
                                             (unchanged timestamp — §9)
```

This is the only backward-looking arrow (or pair of arrows) in the entire
`ProvisioningState` machine; every other transition (§4) moves strictly
forward. `READY` is never regressed from, by this or any other transition —
only `AWAITING_INSTALL`/`INSTALL_CONSENTED` can be revisited, and only via
this one named path.

**`READY` is monotonic as a lifecycle position, not as a claim about current
connectivity.** Once a client reaches `READY`, it never regresses to an
earlier `ProvisioningState` because the agent later disconnects, the
Cloudflare tunnel degrades, or a heartbeat times out — those are runtime
health facts (`AgentStatus`, `Server.status`/`publicStatus`,
`cloudflareProvisioningStatus`), diagnosed separately, not provisioning
regressions:

```
ProvisioningState:  READY                          (unchanged, forever)
Runtime health:     AgentStatus = DISCONNECTED      (fluctuates freely)
                    cloudflareProvisioningStatus = FAILED  (fluctuates freely)
```

A `READY` client with a disconnected agent is a `READY` client that
Diagnostics correctly shows as currently unhealthy — not a client "back in
`PROVISIONING`." `ProvisioningState` answers "has this client ever been
fully installed," not "is it currently working."

### 3.2 Formal definition of `READY`

**Definition:** *`READY` means the Agent has successfully registered at
least once, and every backend-owned provisioning prerequisite required for
a working, addressable client session is satisfied.*

Backend-owned prerequisites satisfied by today's `register`, in order:
1. `agentToken` validated against the stored value (`tinta-agent.gateway.ts:142-150`).
2. `AgentSession` updated (`status`, `lastConnectedAt`, `lastHeartbeatAt`).
3. `Server.status`/`lastSeenAt` heartbeat recorded (`servers.service.ts:181-199`).
4. `installToken` consumed (§9).

**`READY` explicitly, permanently excludes:**
- HA connected — confirmed not observable backend-side at all (§1).
- Cloudflare reachable / tunnel healthy — resource evidence (§3.3).
- All golden templates applied — optimistic, unacknowledged (§12); see §3.2.1.
- SUPPORT access enabled — an independent, admin-toggled feature
  (`Server.accessEnabled`), unrelated to installation completion.
- Agent metrics available — telemetry, arrives after `register`, can be
  absent even for a healthy `READY` client.

Because there is currently exactly one event (`register` succeeding) that
satisfies all four backend-owned prerequisites simultaneously, there is no
present-day scenario requiring an intermediate state between "not yet
connected" and "all prerequisites satisfied" — hence one `READY` state.

#### 3.2.1 Templates are not a `READY` gate, and `APPLIED` requires a real ACK

```
templateDeliveryStatus (per template, or summarized) =
  PENDING  — not yet sent (agent not connected)
  SENT     — emit() returned true (the ceiling of what today's code can
             honestly claim)
  APPLIED  — NOT reachable in Phase 1.4. Governing rule, verbatim:

             APPLIED MUST NOT be persisted based solely on a successful
             socket.emit(). It requires an explicit agent acknowledgement
             that does not exist yet (§12's designed-not-built ACK
             protocol). Until that Agent-repo change ships, no code path
             in this backend may write APPLIED.

  FAILED   — per §12's classification
```

This status is informational, surfaced alongside `ProvisioningState` (e.g. in
`AgentSessionViewDto`, §21) but never blocks or reverses a `READY`
transition, and never regresses `ProvisioningState` either (§3.1).

#### 3.2.2 Atomicity of the `READY` write — hard rule

§3.2's four prerequisites touch several fields
(`AgentSession.status`/`lastConnectedAt`/`lastHeartbeatAt`,
`Server.status`/`lastSeenAt`, `installToken` consumption). Left unstated,
this invites a crash between two of those writes leaving `lastConnectedAt`
set but `provisioningState` still `INSTALL_CONSENTED` — the same class of
bug this whole phase exists to close.

**Hard rule:** the transition to `READY` MUST atomically persist, as one
local DB write, exactly these two lifecycle-owned fields:

```
AgentSession.provisioningState = READY
Client.isInstalled             = true
```

Nothing else is part of this atomic write:
- `AgentSession.status`, `lastHeartbeatAt`, `metrics` — runtime telemetry,
  written independently, never blocking this write.
- `Server.status`/`lastSeenAt` heartbeat — already an independent local
  write today (`servers.service.ts:181-199`); a *prerequisite* for reaching
  `READY` (§3.2), not part of the same atomic statement.
- `installToken` consumption — already its own idempotent write (§9); must
  have happened, but is not re-executed as part of this write.
- Any external/network call (Cloudflare, template push) — never included in
  a lifecycle-write transaction, per §6.2's general rule.

This is deliberately a small, single-table, single-statement transaction —
not an attempt to wrap all of `register()` in one transaction, which would
reintroduce the "one big cross-system transaction" problem §6.2 rules out.
It only guarantees that the two fields jointly declaring "this client is
installed" cannot desync from each other.

### 3.3 Resource/Health evidence (replaces `SERVER_DEGRADED`)

Lives on `Server`, alongside the existing Cloudflare-related columns
(`tunnelId`, `tunnelToken`, `cfDnsRecordId`, `cfAccessAppId`,
`server.entity.ts:49-62`). New fields:

```
cloudflareProvisioningStatus: PENDING | PROVISIONED | FAILED
cloudflareFailureCode: string | null   -- e.g. TUNNEL_CREATE_FAILED,
                                            TOKEN_FETCH_FAILED,
                                            DNS_RECORD_FAILED,
                                            ACCESS_APP_FAILED (§7 case C)
```

`PROVISIONED` requires the **complete** resource set (tunnel + token + DNS
record, and the Access application if configured) to be confirmed present —
not any single field's non-nullness. See §20 for why this matters
specifically for historical-data backfill.

These are read by Diagnostics' existing `cloudflare`/public-connectivity
check (already implemented, Phase 1.3) as additional evidence. A client can
be `ProvisioningState: READY` and `cloudflareProvisioningStatus: FAILED`
simultaneously — a legitimate, non-contradictory, fully-visible state.

**Whether the Diagnostics `cloudflare` check itself needs code changes to
read these two new fields is a §19-style cross-phase question**, called out
in §19, not assumed here.

---

## 4. State transition matrix — **PROPOSED**

Per §3.1, `ProvisioningState` transitions only begin once `AgentSession`
exists. Everything before that is `ProvisioningOperation` progress (§6.1),
covered in §6, not in this table.

| Current state | Event | Result | Idempotent? | Side effects |
|---|---|---|---|---|
| *(no `AgentSession` yet)* | `ProvisioningOperation` reaches `lastCompletedStep = ENSURE_AGENT_SESSION`, creates the row | → `AWAITING_INSTALL` (the first `ProvisioningState` value this client ever has) | — | AgentSession insert |
| `AWAITING_INSTALL` | `provision` retried, same client/resource identity (§4.1) | **no destructive rotation** — return existing `installToken`/state, do not force-disconnect, do not mint a new token unless expired | yes | none (or token reissue only if expired) |
| `AWAITING_INSTALL` | `GET /install/:token` consent recorded | → `INSTALL_CONSENTED` | — | `serviceStartConsentAt` set once |
| `AWAITING_INSTALL` / `INSTALL_CONSENTED` | installToken TTL elapses | → `INSTALL_EXPIRED` | — | none (lazy transition, evaluated on read) |
| `INSTALL_CONSENTED` | agent `register` succeeds, §3.2 prerequisites satisfied | → `READY` (§3.2.2 atomic write) | — | `lastConnectedAt` set, `isInstalled` set in the same write |
| `INSTALL_EXPIRED` | `provision` retried / admin retry | → `AWAITING_INSTALL` if `serviceStartConsentAt IS NULL`, else → `INSTALL_CONSENTED` (the one named exception to monotonicity, consent-aware — §3.1); new `installToken` minted either way | yes | UPDATE only, **agentToken is not touched**, `serviceStartConsentAt` never modified |
| `READY` | `provision` retried, **same** `Idempotency-Key` | replay cached result, **no new resources, no rotation, no disconnect** | yes | none |
| `READY` | `provision` retried, **new** `Idempotency-Key` (or none), same client | see §4.1 — resource identity governs this, not an inference | policy-dependent | see §4.1 |
| `READY` | explicit `POST /tinta-core/provision/:clientId` (already-existing, separate, ADMIN-only endpoint) | credential rotation, force-disconnect — **unchanged** | n/a — intentionally destructive, by design | agentToken/installToken rotated |

**Note on failure and retry:** an unrecoverable error during Client
resolution, Server creation, or AgentSession creation itself never appears
in this table at all — it is a `ProvisioningOperation.status = FAILED`
outcome (§6.1, §6.4), and by definition occurs before any row in this table
applies. A retry with the same `Idempotency-Key` reopens that *same*
`ProvisioningOperation` (`FAILED → IN_PROGRESS`, §5.4's conditional
`ON CONFLICT`) and resumes from its `lastCompletedStep`; a retry with no
key gets a genuinely new `ProvisioningOperation` instead (§5.1, §6.4) — if
either path succeeds in creating `AgentSession` for the first time, the
client's `ProvisioningState` begins at `AWAITING_INSTALL`, exactly like the
top row of this table, regardless of how many prior attempts failed.

### 4.1 New operation for an already-`READY` client — **PROPOSED, resource identity required**

The audit confirms `ServersService.create()` has no existence check at all
(`servers.service.ts:41-98`), and the system deliberately supports multiple
`Server`s per `Client` (`servers.service.ts:299-314`), so "an existing
Server → reuse it" cannot be automatic without breaking that legitimate
case.

The resolution is **resource identity, not `clientId` alone**:

- `existingClientId` + a **new** `subdomain`/`serverName` → always creates a
  new `Server`, new `ProvisioningOperation`, unconditionally — the existing
  multi-server capability is preserved exactly, untouched by this phase.
- `existingClientId` + a `subdomain` that **already exists** for that client
  → `Server.subdomain` is already `unique` at the DB level
  (`server.entity.ts:41-42`) — a repeat attempt with the same subdomain
  resolves to the *existing* `Server` row deterministically (never a second
  row, never the raw 500 the audit found — §16, `SUBDOMAIN_TAKEN`).
- No `existingClientId`, brand-new client resolved by email → §5's
  `Idempotency-Key`/fingerprint mechanism prevents accidental duplication
  here; a genuinely new admin action (new key) for the same email is
  allowed to proceed, exactly like a second `existingClientId` call with a
  new subdomain would.

**Deterministic operation→resource binding.** `ProvisioningOperation` (§6.1)
carries a nullable `serverId`, set as soon as the Server step completes
(either by creating a new row or by resolving to an existing one via
`(clientId, subdomain)`). This removes any ambiguity about "which operation
created/owns which Server": recovery always does `operation → serverId`, a
direct field read, never a fallback search. For a client with several
Servers, each `ProvisioningOperation` still points at exactly one.

**Identity for deduplication purposes is `(clientId, subdomain)` for the
Server-creation step** — not `clientId` alone and not the `Idempotency-Key`
alone. The key deduplicates *requests*; `(clientId, subdomain)` deduplicates
the *resource*.

The critical behavior change from current code: **`READY` clients must stop
being destructively re-provisioned by `POST /provisioning/client`** (today
`tinta-core.service.ts:86-99` rotates unconditionally on every repeat call)
— but "no destructive rotation" is orthogonal to "can a new Server be
added," which the resource-identity rule above governs separately.

---

## 5. Idempotency model — **PROPOSED**

### 5.1 What identifies an operation

Confirmed rejected as the idempotency key: **email alone** — email
identifies the *user*, not a *provisioning operation*.

Two distinct identifiers, kept separate on purpose:

```
Idempotency-Key   — caller-supplied deduplication key (HTTP header).
                    Exists to let a client detect "have I already sent
                    this exact request." Meaningless outside the HTTP
                    layer.

operationId       — server-generated, stable identity of the
                    provisioning operation itself. Exists everywhere
                    internally: provisioning_events rows (§18), recovery
                    lookups (§6), the API response, Diagnostics evidence.
                    One real operation → exactly one operationId, for its
                    entire lifetime, independent of how many HTTP retries
                    reference it.
```

An `Idempotency-Key` resolves (via a lookup, §5.4) to at most one
`operationId`. Internal code — reconciliation crons, anything not sitting
behind the HTTP controller — only ever deals in `operationId`.

### 5.2 Full replay semantics

For a given `(authenticated principal, Idempotency-Key)` pair:

```
same principal + same key + same request fingerprint
    → same key, same intent → return the same logical result
      (replay cached response if SUCCEEDED; if still IN_PROGRESS,
      return 409 "provisioning in progress"; if FAILED, REOPEN the
      SAME operation — status FAILED → IN_PROGRESS, same operationId
      — and resume from its lastCompletedStep — §6.4. This is NOT a
      new ProvisioningOperation: §5.4's unique index is keyed on
      (principal, key), so a genuinely new row for the same key would
      violate it. One key → one operationId for that key's entire
      retry history, whatever its outcome.)

same principal + same key + different request fingerprint
    → 409 Conflict, "Idempotency-Key reuse with different payload" —
      and critically, this comparison is not a check performed after
      the atomic claim; it is folded into the same conflict-resolution
      statement (§5.4), so a mismatched-fingerprint retry can never
      itself flip a FAILED row to IN_PROGRESS before being rejected

new key (or no key)
    → new ProvisioningOperation — subject to §4.1's resource-identity
      rule, which is what actually prevents duplication for the
      same-client case; the key alone does not
```

### 5.3 Fingerprint composition — deterministic only

Fingerprint = a hash over the fields of `ProvisionClientDto` that actually
determine the provisioning result: `email`, `existingClientId`, `serverName`,
`subdomain`, `phone`, `city`, `applyDefaultTemplates`, `localUrl`.

**Explicitly excluded:**
- `password` — no hash of a credential is ever persisted, and it is not
  needed to detect "different intent."
- Timestamps.
- Generated IDs (anything the server itself produced).
- Random values or server-side defaults substituted for optional fields.

The fingerprint is computed only from what the *caller* deterministically
supplied as meaningful business input.

### 5.4 Atomic claim — race safety, not just sequential retry

A naive "check if a `ProvisioningOperation` exists for this key, then insert
one" has a race window — two concurrent requests with the same key can both
pass the check before either inserts.

**Required:** the claim is a single atomic DB operation. `provisioning_operations`
gets a partial unique index (not a plain table-wide `UNIQUE` constraint,
since ordinary Postgres `UNIQUE` allows multiple `NULL`s, which is fine here
but the *intent* — "unique only when a real key was supplied" — should be
explicit rather than incidental):

```sql
CREATE UNIQUE INDEX provisioning_operations_principal_key_idx
  ON provisioning_operations (principal_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

**The fingerprint match must be part of the same atomic statement, not a
check performed after it.** An earlier version of this clause guarded the
reopen only on `status = 'FAILED'`, which does not by itself stop a retry
carrying a *different* fingerprint from flipping a `FAILED` row to
`IN_PROGRESS` — the very thing §5.2's "different fingerprint → 409" rule
exists to prevent. If the fingerprint check ran as a separate,
after-the-fact application step, the unwanted reopen would already have
happened in the database by the time that check ran. The claim is
therefore:

```sql
INSERT INTO provisioning_operations (operation_id, principal_user_id,
    idempotency_key, request_fingerprint, status, ...)
VALUES ($1, $2, $3, $4, 'IN_PROGRESS', ...)
ON CONFLICT (principal_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL
DO UPDATE SET
  status = 'IN_PROGRESS',
  failure_code = NULL,
  failure_message = NULL,
  completed_at = NULL
WHERE provisioning_operations.status = 'FAILED'
  AND provisioning_operations.request_fingerprint = EXCLUDED.request_fingerprint
RETURNING *;
```

Adding `AND ... request_fingerprint = EXCLUDED.request_fingerprint` to the
`DO UPDATE ... WHERE` guard means the row is only ever mutated when both
conditions hold — `FAILED` *and* same fingerprint — inside the one atomic
statement. This covers all four real outcomes, and the caller determines
which one occurred purely by inspecting the single returned row (no
separate lookup needed for three of the four):

- **No conflict** (row didn't exist) → insert succeeds, this request owns a
  brand-new operation, proceeds from `RESOLVE_CLIENT`.
- **Conflict, existing row `status = FAILED`, fingerprint matches** → the
  `DO UPDATE ... WHERE` guard matches on both conditions, the row flips to
  `IN_PROGRESS` **in place** (same `operationId`), clearing the previous
  failure detail; this request owns the reopened operation and resumes
  from its `lastCompletedStep` (§6.4).
- **Conflict, existing row `status = FAILED`, fingerprint differs** → the
  guard's fingerprint condition fails, so `ON CONFLICT` degrades to a
  no-op (the row is returned completely unchanged, still `FAILED` with its
  original fingerprint). The caller compares the returned row's
  `request_fingerprint` against the one it just computed for this request;
  a mismatch here is exactly §5.2's "different fingerprint" case → `409
  Conflict`, and critically, the database was never mutated to get to this
  answer.
- **Conflict, existing row `status` is `IN_PROGRESS` or `SUCCEEDED`** (any
  fingerprint) → the guard's status condition fails, `ON CONFLICT` again
  degrades to a no-op, the row is returned unchanged; the caller then
  applies §5.2's ordinary branching on the returned row — fingerprint
  mismatch → 409 regardless of status; fingerprint match + `IN_PROGRESS` →
  409 "provisioning in progress"; fingerprint match + `SUCCEEDED` → replay
  `cachedResult`.

In every one of these four cases, the fingerprint comparison that decides
"is this really the same request" is resolved either inside the atomic
`WHERE` clause (for the reopen case, where a wrong answer would mean an
unwanted mutation) or by the caller reading the single `RETURNING` row
(for the no-mutation cases, where a wrong answer only means picking the
wrong HTTP response, not corrupting data) — never by a separate query that
could race against a second, concurrent claim attempt.

Postgres evaluates `ON CONFLICT ... DO UPDATE ... WHERE` as a single atomic
statement, so this four-way branch has no race window of its own — it is
exactly as race-safe as the simpler `DO NOTHING` form this replaces, while
also being the mechanism that makes §6.4's "retry a FAILED operation"
promise actually deliverable under the unique index without weakening
§5.2's fingerprint-mismatch guarantee.

This is a "first-writer-wins" claim, which is why a unique index +
`ON CONFLICT` is the right tool here, rather than the advisory lock the
existing audit hash chain uses (`AUDIT_CHAIN_LOCK_KEY`,
`audit-log.service.ts:9-10`) for its different, "serialize all writers"
problem.

### 5.5 Idempotency lives in the domain service, not the controller

```
ProvisioningController.provisionClient(dto, idempotencyKeyHeader?)
        ↓  (just forwards the header value as a plain argument)
ProvisioningService.startOrResume(dto, { principalUserId, idempotencyKey? })
        ↓
  atomically claims/resolves the ProvisioningOperation (§5.4)
        ↓
  drives ProvisioningOperation's own step progress (§6.1), and once
  AgentSession exists, the ProvisioningState machine (§3, §4) for that client
        ↓
  reconciliation (§6, §7) is the same code path a retry takes,
  whether the retry came from the same HTTP call or from a cron
        ↓
  resources (Client, Server, Cloudflare, AgentSession)
```

`startOrResume()` is the one and only entry point that creates or advances a
`ProvisioningOperation`. Without an `Idempotency-Key`, it still creates a new
operation every call — full request-level dedup is opt-in via the header;
§4.1's `(clientId, subdomain)` resource identity is the always-on safety net
underneath it regardless of whether a key was supplied.

### 5.6 When does a `ProvisioningOperation` become `SUCCEEDED`? — **P0, resolved**

**Resolution:** `ProvisioningOperation` represents completion of the
**provisioning API execution / resource preparation**, not of the Agent's
own lifecycle. It answers "did the `POST /provisioning/client` call finish
doing what it's responsible for," not "has the client finished installing."

```
POST /provisioning/client
        ↓
operation IN_PROGRESS
        ↓
Client resolved            (lastCompletedStep = RESOLVE_CLIENT)
Server resolved/created    (lastCompletedStep = ENSURE_SERVER)
Cloudflare reconciled      (lastCompletedStep = RECONCILE_CLOUDFLARE)
AgentSession resolved      (lastCompletedStep = ENSURE_AGENT_SESSION)
                            ← ProvisioningState begins here, at AWAITING_INSTALL (§3.1, §4)
install flow prepared      (lastCompletedStep = PREPARE_INSTALL)
        ↓
operation SUCCEEDED        (lastCompletedStep = COMPLETE)
        ↓
ProvisionResultDto returned/cached
```

**`COMPLETE` is defined precisely, with a required write order, so
`SUCCEEDED` can never be observed without a replayable result behind it:**
`COMPLETE` means every operation-owned step above has finished and the
following three fields are set in one local DB write, in this order within
that statement — `cachedResult` (the `ProvisionResultDto` to replay),
then `status = SUCCEEDED`, then `completedAt` — so that any reader
observing `status = SUCCEEDED` is guaranteed `cachedResult` is already
present (there is no intermediate state where `status` says `SUCCEEDED`
but `cachedResult` is still null). This is the same "small, local,
single-statement" discipline as §3.2.2's `READY` write, applied to the
operation's own completion instead of the client's lifecycle transition.

At this point `AgentSession.provisioningState` is `AWAITING_INSTALL` (or
further along, if e.g. consent was already recorded from a prior operation)
— and it can **remain** there indefinitely. The operation that got it there
is already `SUCCEEDED`. Later:

```
GET /install/:token           → INSTALL_CONSENTED
Agent register                → READY
```

...both happen with **no open `ProvisioningOperation`** — they are driven
directly by `ProvisioningState` transitions (§4), not by any operation's
status. This is what makes §5.2 consistent: `same key + SUCCEEDED → replay
cached result` is correct even if the client is still `AWAITING_INSTALL`
weeks later, because the *operation* (the API call's own work) is genuinely
done — Cloudflare provisioned, AgentSession created, install link issued.
`IN_PROGRESS` only ever means "the current HTTP call (or its unfinished
resumption) hasn't finished its own resource-preparation work yet," never
"the client hasn't finished installing yet."

**Reconciling with §4.1/`AWAITING_INSTALL` retries:** a `provision` retry
against an already-`AWAITING_INSTALL` client, using the *same*
`Idempotency-Key` as the original (now-`SUCCEEDED`) operation, is a replay
(§5.2) — it returns the cached result, no new work. A retry with a
*different or no* key against the same `(clientId, subdomain)` resource
identity resolves per §4.1 (finds the existing Server, does not duplicate
it) inside a **new** `ProvisioningOperation`, which itself reaches
`SUCCEEDED` quickly since every step short-circuits on already-satisfied
state.

---

## 6. Operation lifecycle & crash recovery — **PROPOSED**

`operationId` is not "just a UUID" — it has its own persistence model
capable of answering, after a crash: what did we already do, what's left,
what's safe to repeat, what needs reconciliation.

### 6.1 `ProvisioningOperation` persistence model

`provisioning_operations` table:

```
operationId          uuid, PK
clientId              nullable until RESOLVE_CLIENT completes
serverId              nullable until ENSURE_SERVER completes (§4.1) —
                      deterministic operation→resource binding, no
                      "search for the owning operation" ever needed
idempotencyKey        nullable
principalUserId       who initiated it
requestFingerprint    §5.3
status                IN_PROGRESS | SUCCEEDED | FAILED  — §5.6 defines
                      the completion boundary precisely; FAILED is the
                      ONLY place a provisioning failure is recorded
                      (§3.1 — it is not a ProvisioningState value).
                      FAILED is reopenable: a retry presenting the SAME
                      (principalUserId, idempotencyKey) transitions this
                      exact row FAILED → IN_PROGRESS in place (§5.4's
                      conditional ON CONFLICT) — it does NOT get a new
                      operationId, since the unique index on
                      (principalUserId, idempotencyKey) would otherwise
                      make a second row for the same key impossible to
                      insert. A key with no idempotencyKey at all (never
                      claimed the index) has no such constraint and does
                      get a fresh operationId on every retry, per §5.1.
lastCompletedStep     RESOLVE_CLIENT | ENSURE_SERVER | RECONCILE_CLOUDFLARE
                      | ENSURE_AGENT_SESSION | PREPARE_INSTALL | COMPLETE
                      — an explicit cursor, not inferred from resource
                      inspection alone. This is what lets a crash recovery
                      or a FAILED retry answer "what's left" directly:
                      lastCompletedStep = ENSURE_SERVER means skip
                      RESOLVE_CLIENT and ENSURE_SERVER, resume at
                      RECONCILE_CLOUDFLARE. This is a technical cursor on
                      ProvisioningOperation, not a lifecycle state — it
                      never appears in ProvisioningState (§3.0's hard
                      rule) and has no meaning outside recovery/resume
                      logic. Per §3.1's v2.2 fix, these first four values
                      (RESOLVE_CLIENT through ENSURE_AGENT_SESSION) are
                      exactly the work that used to be mismodeled as
                      CREATED/PROVISIONING_SERVER ProvisioningState values
                      — this field was always the correct home for them.
createdAt
updatedAt             bumped on every step transition, not just at the
                      end — this is what lets the stuck-operation check
                      in §14 work
completedAt           nullable
failureCode           nullable (§16) — set only when status = FAILED
failureMessage        nullable, human-readable detail (never secrets — §18)
cachedResult          jsonb, nullable — the ProvisionResultDto to replay
```

Unique index per §5.4.

### 6.2 Step-level resumability

This is **not** solved with one cross-system DB transaction (§7 explains why
the Cloudflare portion specifically cannot be). The correct terms for what
this phase actually builds:

> **Durable state machine + idempotent resource operations +
> reconciliation/compensation.** A Postgres transaction is used only where
> it actually applies — atomic *local* DB writes (the `provisioning_operations`
> claim in §5.4, the `READY` write in §3.2.2, or a single entity's
> insert/update) — never across the Cloudflare API call, which no database
> transaction can include or roll back.

Each step checks `lastCompletedStep` first (cheap, direct) before falling
back to resource inspection only where the step itself is inherently
resource-keyed (Cloudflare's own sub-steps, §7, which are keyed off the
`Server` row's columns regardless of `lastCompletedStep`, since a Cloudflare
retry can be triggered by the reconciliation cron independently of any
particular operation):

- Client: check `lastCompletedStep >= RESOLVE_CLIENT`; if resuming from
  `absent`, fall back to `existingClientId`/email lookup (§1, already
  idempotent).
- Server: check `lastCompletedStep >= ENSURE_SERVER` and `operation.serverId`;
  if resuming without a `lastCompletedStep` (e.g. an operation row lost
  before any step recorded — should not happen given `updatedAt` is bumped
  per step, but defensively), fall back to `(clientId, subdomain)` existence
  check (§4.1) — this is audit finding #1, `SUBDOMAIN_TAKEN` (§16), fixed
  either way.
- Cloudflare: §7's case A/B/C, keyed off the `Server` row's own
  `tunnelId`/`cfDnsRecordId`/`cfAccessAppId` columns, independent of
  `operationId`/`lastCompletedStep` entirely.
- AgentSession: check `lastCompletedStep >= ENSURE_AGENT_SESSION`; already
  idempotent via the unique `clientId` constraint
  (`agent-session.entity.ts:26-27`) as a fallback — but currently reacts to
  "already exists" by rotating instead of resuming, which §4 fixes. This is
  also the exact step where `ProvisioningState` begins to exist (§3.1) —
  before this step completes, a crash leaves no `ProvisioningState` at all
  for the client, only the operation's `lastCompletedStep`.

### 6.3 The critical acceptance scenario

```
POST /provisioning/client
Idempotency-Key: X
        ↓
Client created         (lastCompletedStep = RESOLVE_CLIENT)
Server created          (lastCompletedStep = ENSURE_SERVER)
Cloudflare tunnel created (lastCompletedStep = RECONCILE_CLOUDFLARE)
        ↓
PROCESS CRASH (operation left status = IN_PROGRESS,
                lastCompletedStep = RECONCILE_CLOUDFLARE)
        ↓
[restart]
        ↓
POST /provisioning/client
Idempotency-Key: X   (same key, same payload)
```

**Required result:**
```
NOT:  new Client, new Server, new Cloudflare tunnel
YES:  resume at ENSURE_AGENT_SESSION — the operation's lastCompletedStep
      tells the retry exactly what's already done without re-deriving it
      from resource inspection; zero duplicate resources. Note that at
      this crash point, no AgentSession exists yet, so the client has no
      ProvisioningState at all — only the operation's lastCompletedStep
      records progress. ProvisioningState first appears once this retry
      completes ENSURE_AGENT_SESSION.
```

And the companion negative case: same key + a **different** payload on
retry → `409 Conflict`, zero side effects — the direct enforcement of
§5.2's mismatch rule.

### 6.4 Operation failure is not client failure

**`FAILED` is terminal for the `ProvisioningOperation`'s current execution
attempt only — it is not a permanent verdict on the client's ability to
ever reach `READY`, and (per §3.1) it is not a `ProvisioningState` value at
all**, since every currently enumerated failure (§16) occurs before
`AgentSession` exists.

**Retrying with the same `Idempotency-Key` reopens the same operation** —
per §5.2/§5.4, this is not a new `operationId`, since the unique index
would make a genuinely new row for the same key un-insertable. `FAILED` is
therefore better read as "paused, resumable," not "closed":

```
Operation X: status FAILED (e.g. failed at ENSURE_SERVER: SUBDOMAIN_TAKEN race)
retry, same Idempotency-Key
Operation X: status IN_PROGRESS again (same operationId), resumes from
             its own lastCompletedStep → SUCCEEDED
        ↓
AgentSession created for the first time → ProvisioningState begins at
AWAITING_INSTALL, exactly as if there had been no prior failure
```

(Retrying with **no** `Idempotency-Key` at all does create a genuinely new
`operationId` each time, per §5.1 — there is no index entry to reopen. This
is still safe because §4.1's `(clientId, subdomain)` resource-identity
check runs regardless of which operation is doing the checking.)

In the rare case a failure occurs *after* `AgentSession` already exists
(e.g. an error while building the install-URL response during
`PREPARE_INSTALL`, after `ENSURE_AGENT_SESSION` already succeeded) — the
already-created `AgentSession`'s `ProvisioningState` is unaffected; it
remains whatever it was validly set to (`AWAITING_INSTALL`). The
operation's `FAILED` status governs only whether the API caller received a
successful response, never the already-real `AgentSession` state. A retry
in this case resumes from `PREPARE_INSTALL`, re-deriving the same response
from the already-existing `AgentSession`.

---

## 7. Cloudflare failure/recovery — **PROPOSED**

Explicitly **not** a single DB transaction spanning the Cloudflare API call
(§6.2's general principle, concretely instantiated here).

```
Case A — nothing created yet
  Server exists, tunnelId = null
  → retry: run CloudflareService.provisionServer() from the start

Case B — tunnel exists, DB write incomplete
  Cloudflare tunnel actually exists, but the Server row never got
  tunnelId/tunnelToken written (crash between the Cloudflare call and
  the servers.service.ts UPDATE)
  → retry: look up the tunnel by a DETERMINISTIC identity, not a
    choice between mechanisms. Resolution: Cloudflare tunnel names
    are derived deterministically from the Server's own stable
    identity (the hubId already generated before any Cloudflare call,
    cloudflare.service.ts:14-17) — e.g. tunnel name = `hub-{hubId}`.
    Recovery is then a single deterministic lookup:
        expected tunnel name = `hub-{hubId}` (hubId already known —
          it's a Server column, set before Cloudflare is ever called)
              ↓
        Cloudflare API: find tunnel by that exact name
              ↓
        found     → reconcile: write its tunnelId/tunnelToken to the
                    Server row, continue from there
        not found → nothing was actually created; treat as Case A
  This replaces any "list-by-name OR store-tunnelId-as-first-substep"
  ambiguity — a store-first approach cannot itself be the recovery
  mechanism, since the scenario being recovered from is precisely a
  lost DB write, so the deterministic-lookup mechanism above is the
  only one that actually functions as recovery, not merely as
  prevention.

Case C — tunnel + DNS exist, Access application failed
  → retry: skip tunnel/DNS creation entirely (already present per the
    stored tunnelId/cfDnsRecordId), retry only the Access-app sub-step
```

Mechanically:
- `CloudflareService.provisionServer()` (`cloudflare.service.ts:63-126`)
  already performs its sub-steps in a fixed order (tunnel → ingress config →
  token → DNS → optional Access app). Each sub-step's result must be
  persisted on the `Server` row **as it completes**, not only at the end —
  this is what makes Case C possible; it does not change what makes Case B
  recoverable, which is the deterministic tunnel-name lookup above, not the
  incremental write.
- `cloudflareProvisioningStatus`/`cloudflareFailureCode` (§3.3) record which
  of the three cases applies.
- Retry is **not** an automatic tight-loop cron — a low-frequency
  reconciliation pass (e.g. every 15 minutes, reusing the existing
  `@nestjs/schedule` pattern already used by `AgentMonitorScheduler`) plus
  an explicit admin-triggered retry endpoint (§15).
- No compensation ever deletes a partially-created Cloudflare resource
  automatically — `ServersService.delete()` already does full Cloudflare
  cleanup (`servers.service.ts:280-291`) and remains the only path that
  tears things down.

---

## 8. AgentSession lifecycle

`ProvisioningState` and `AgentSession.status` (`AgentStatus`) remain two
separate fields with two separate meanings (§3.1's monotonicity rule is the
formal statement of this).

- `AgentStatus` (`CONNECTED`/`DISCONNECTED`) keeps meaning exactly what it
  means today — it fluctuates constantly and is not touched by this phase's
  changes, other than the startup-reconciliation fix in §14.
- `ProvisioningState` only ever moves forward and is written far less often.
- **Storage location:** extend `AgentSession` with a single new
  `provisioningState` column (enum: `AWAITING_INSTALL`/`INSTALL_CONSENTED`/
  `INSTALL_EXPIRED`/`READY`, §3.1). **No `provisioningFailedAt`/
  `provisioningFailureReason` columns are added to `AgentSession`** (v2.1
  proposed these; removed in v2.2) — failure detail lives entirely on
  `ProvisioningOperation.failureCode`/`failureMessage` (§6.1), since a
  failure can occur before `AgentSession` exists at all, so `AgentSession`
  is not always available to hold it.
  `ProvisioningOperation` (§6.1) is intentionally a **separate** table — it
  tracks individual attempts/executions, of which there can be several per
  client over time (§4.1), whereas `AgentSession.provisioningState` reflects
  the client's single current lifecycle position, and only exists once the
  row does.
- `Server.status`/`Server.publicStatus` remain untouched — per §3.0's hard
  rule, they are runtime health, never `ProvisioningState`.

---

## 9. Install token lifecycle (formalized, not changed)

- Generated as `randomUUID()`, 48h TTL, stored on `AgentSession.installToken`/
  `installTokenExpiresAt` (`tinta-core.service.ts:71-72`).
- One-time use, enforced redundantly at three call sites
  (`provisioning.service.ts:249-252`, `tinta-core.service.ts:158-163`,
  `tinta-agent.gateway.ts:209-211`).
- Consent (`POST /install/:token/consent`) is idempotent by an explicit
  `if (!session.serviceStartConsentAt)` guard and must stay that way — it
  is a write-once §356 BGB legal timestamp.
- New in this phase: expiry (`INSTALL_EXPIRED`) becomes an observable
  `ProvisioningState`, retry-able without forcing a full Client/Server
  re-provision — and the retry respects this section's write-once guard:
  it never resets `serviceStartConsentAt`, and correspondingly never sends
  an already-consented client back to a `ProvisioningState` whose own
  definition requires consent to be absent (§3.1's consent-aware
  `INSTALL_EXPIRED` retry branching).

---

## 10. Agent token lifecycle (formalized, one behavior change)

- Generation, JWT shape, 365-day expiry, and the byte-comparison-against-stored-value
  check at `register` (`tinta-agent.gateway.ts:142-150`) confirmed correct
  and unchanged.
- **Behavior change (per §4):** `POST /provisioning/client` must stop
  unconditionally rotating `agentToken` on every repeat call against the
  same operation/resource identity (§4.1). Only mint a fresh `agentToken`
  when creating a brand-new `AgentSession` or resuming from `INSTALL_EXPIRED`.
- Intentional rotation of a `READY` client's `agentToken` remains available,
  unchanged, via `POST /tinta-core/provision/:clientId`.

---

## 11. Tunnel token lifecycle (formalized, one addition)

- Creation, storage, and distribution confirmed correct and unchanged.
- No rotation path exists, and this phase does not add one.
- Addition per §7: recovering a `cloudflareProvisioningStatus: FAILED`
  server must reuse the existing `tunnelId` via the deterministic lookup
  (§7 Case B) rather than creating a second orphaned tunnel.

---

## 12. Template delivery semantics — split per §2, and see §3.2.1

**FIX (in scope):** `provisioning.service.ts:148-153`'s `.catch(() => {})`
is replaced with explicit classification:

```
expected:   AgentSession exists but agent not yet connected
            → DEBUG/INFO log, template stays PENDING
unexpected: anything else → ERROR, classified as TEMPLATE_UNEXPECTED (§16),
            written to provisioning_events (§18) with clientId +
            templateSlug + error detail
```

**DESIGN/CONTRACT only (not implemented in Phase 1.4):**

```
backend → apply_template (existing, tinta-agent.gateway.ts:314-322)
agent   → template_apply_ack { slug, success, error? }   ← NEW, Agent-repo change
backend → templateDeliveryStatus: APPLIED only on ack.success === true
```

Until the Agent repo implements the ack, the backend only ever writes
`SENT` — never `APPLIED` (§3.2.1's governing rule).

---

## 13. `Client.isInstalled` semantics — derived compatibility field, not source of truth

```
Source of truth:     AgentSession.provisioningState (§3, §8)
Derived projection:  Client.isInstalled
```

`isInstalled` is written to `true` exactly once, in the same atomic write
that performs the `→ READY` transition (§3.2.2) — never computed live,
never reset back to `false` afterward.

**Migration implication (§20):** existing `Client` rows backfilled using
`isInstalled = (AgentSession.lastConnectedAt IS NOT NULL)`.

---

## 14. Startup reconciliation — **PROPOSED, scoped to provisioning only**

Explicitly not the same work as P2.3's WebSocket lifecycle hardening.

- Any `AgentSession` with `status = CONNECTED` is not immediately flipped —
  the existing `AgentMonitorScheduler` heartbeat-timeout check
  (`agent-monitor.scheduler.ts:35-40`) is made to run once immediately on
  boot, bounding the 5-minute-staleness window to "since restart."
- Any `ProvisioningOperation` (§6.1) stuck `IN_PROGRESS` with `updatedAt`
  older than a threshold (proposed: 10 minutes) is surfaced as retry-eligible
  for the reconciliation cron (§7/§15), using its `lastCompletedStep` to
  know exactly where to resume.
- Does not attempt to guess or replay in-flight Cloudflare calls — only
  makes stuck operations visible and retry-eligible.

---

## 15. Retry / backoff rules — **PROPOSED**

- **Cloudflare reconciliation** (§7): scheduled cron (15 min proposed) +
  on-demand admin trigger. No exponential backoff.
- **Install-token expiry retry**: admin-triggered only.
- **`FAILED` operation**: admin-triggered retry only. If the retry carries
  the same `Idempotency-Key` as the failed operation, it reopens that same
  operation in place (§5.4, §6.4); with no key, it starts a genuinely new
  `ProvisioningOperation` instead. Either way it resumes from the failed
  attempt's `lastCompletedStep`.

---

## 16. Failure classification — **PROPOSED**

These codes are recorded exclusively on `ProvisioningOperation.failureCode`
(§6.1) — never on `AgentSession`, per §3.1/§8, since a failure can occur
before that row exists:

```
DUPLICATE_EMAIL         — existing ConflictException path (unchanged);
                          occurs during RESOLVE_CLIENT (§6.1)
SUBDOMAIN_TAKEN         — NEW: today an uncaught 500 (audit finding #1),
                          resolved via §4.1's resource-identity lookup
                          instead of reaching this failure at all in the
                          common case; this code is for a genuine conflict
                          §4.1's lookup can't resolve — two concurrent
                          operations with NO shared Idempotency-Key (so
                          §5.4's claim never comes into play for either of
                          them) both attempting ENSURE_SERVER for the same
                          (clientId, subdomain) at once, one losing the
                          race against the Server.subdomain DB-level
                          unique constraint itself (server.entity.ts:41-42);
                          occurs during ENSURE_SERVER (§6.1)
AGENT_SESSION_FAILED    — unexpected DB error creating/updating AgentSession;
                          occurs during ENSURE_AGENT_SESSION (§6.1), i.e.
                          the row does not yet exist when this fires
TEMPLATE_UNEXPECTED     — per §12 (does not block READY — §3.2.1); the one
                          code that CAN occur after AgentSession exists,
                          but per §12 it is written to provisioning_events,
                          not to a ProvisioningOperation.status (template
                          push is not a gating step, §4/§6.1's step list
                          ends at PREPARE_INSTALL/COMPLETE before templates
                          are ever pushed to a connected agent)
UNKNOWN                 — catch-all, still logs full detail
```

Cloudflare failures are **not** in this enum — `cloudflareFailureCode`
(§3.3, §7) is separate, lives on `Server`, and never drives
`ProvisioningOperation.status` to `FAILED` (Cloudflare failure still allows
the operation to reach `SUCCEEDED` — §1/§3.1's "AgentSession created
unconditionally regardless of Cloudflare outcome" rule).

---

## 17. RBAC (unchanged)

`POST /provisioning/client` and `POST /tinta-core/provision/:clientId` stay
`ADMIN`-only. `GET /install/:token` and `POST /install/:token/consent` stay
public+throttled — D1 explicitly out of scope (§23).

---

## 18. Audit events — **PROPOSED, new mechanism, scoped narrowly**

The existing `audit_events` table is a hash-chained, `accessLogId`-scoped
legal ledger specific to SUPPORT-access — wrong tool here.

`provisioning_events` answers one question only: *what happened to this
specific provisioning operation?* Fields: `id`, `operationId`, `clientId`
(nullable — may not exist yet for the earliest events), `state` (the
`ProvisioningState` at event time, nullable — per §3.1, doesn't exist before
`AgentSession` does), `eventType`, `metadata` (jsonb, evidence only),
`actorUserId` (nullable), `createdAt`. No hash chain, no advisory lock.

```
PROVISIONING_STARTED, CLIENT_RESOLVED, SERVER_CREATED,
CLOUDFLARE_PROVISIONED, CLOUDFLARE_FAILED, AGENT_SESSION_CREATED,
INSTALL_TOKEN_ISSUED, INSTALL_CONSENT_RECORDED, AGENT_CONNECTED,
TEMPLATE_UNEXPECTED, READY, PROVISIONING_FAILED, RECOVERY_STARTED,
RECOVERY_COMPLETED
```

**Hard rule, no exceptions:** `metadata` never contains `agentToken`,
`installToken`, `tunnelToken`, passwords, or raw Cloudflare API
credentials/responses.

---

## 19. Diagnostics integration — flagged for explicit review, touches closed Phase 1.3 code

```
Phase 1.4 introduces a new authoritative ProvisioningState
        ↓
Diagnostics compatibility review
        ↓
if yes (change needed) → separate, minimal, cross-phase compatibility
        change, own tests, own dated addendum to
        PHASE1_3_DIAGNOSTICS_SPEC.md, own atomic commit
if no  → nothing to do, Phase 1.3 stays exactly as closed
```

**Updated per v2.2:** the gap identified in v2.1 ("`checkProvisioning` has
no branch for `FAILED`") no longer applies — `FAILED` was removed from
`ProvisioningState` entirely (§3.1), so there is nothing for
`checkProvisioning` to be missing a branch for. `checkProvisioning`
(`diagnostic-checks.ts:609-670`) already treats "no session exists"
(`hasSession: false`) as its own case, which is now exactly correct: a
client with a `FAILED` `ProvisioningOperation` and no `AgentSession` is
indistinguishable from "not yet provisioned," which is the honest state of
affairs.

The remaining, narrower compatibility question: `checkProvisioning`
currently *re-derives* an approximation of provisioning state from raw
fields (`hasSession`, `lastConnectedAt`, `installTokenExpiresAt`). The new
`AgentSession.provisioningState` column is computed from the same
underlying facts, via the same logic (§20's migration backfill uses
identical conditions). Whether to leave `checkProvisioning`'s independent
derivation as-is (redundant but consistent) or refactor it to read the new
column directly (removes duplication) is a decision for explicit sign-off,
not an inference from "the two phases touch related fields" — but per this
update, it is now a simplification question, not a correctness gap.

---

## 20. Migration / backward compatibility — **PROPOSED**

New `sql/011_provisioning_state_machine.sql`, following the existing
hand-written numbered-file convention (`synchronize: false` in production,
`app.module.ts:55`).

```sql
-- AgentSession.provisioningState, for every EXISTING row (every existing
-- AgentSession row, by definition, already represents a client for whom
-- this column always applies — CREATED/PROVISIONING_SERVER/FAILED are not
-- possible historical values per §3.1, since they were never real
-- ProvisioningState values to begin with, only a v2.1 modeling error):
--   lastConnectedAt IS NOT NULL                        → READY
--   installTokenExpiresAt < now()                      → INSTALL_EXPIRED
--   serviceStartConsentAt IS NOT NULL                   → INSTALL_CONSENTED
--   otherwise                                            → AWAITING_INSTALL

-- Server.cloudflareProvisioningStatus: NOT simply "tunnelToken != null
-- implies PROVISIONED" — Cloudflare provisioning is multiple resources
-- (tunnel, ingress, token, DNS, optional Access app) and historical rows
-- only ever recorded tunnelId/tunnelToken/cfDnsRecordId/cfAccessAppId,
-- with no record of which sub-steps were ever attempted. Backfill can only
-- honestly classify by what is provably present, not assume completeness:
--
--   tunnelId IS NOT NULL AND tunnelToken IS NOT NULL
--     AND cfDnsRecordId IS NOT NULL
--       → PROVISIONED (the full set this backend is capable of recording
--         is present — the strongest claim the historical data supports)
--   tunnelId IS NOT NULL AND (tunnelToken IS NULL OR cfDnsRecordId IS NULL)
--       → FAILED, cloudflareFailureCode = 'HISTORICAL_INCOMPLETE'
--         (a real, distinct code — this is not the same as a freshly
--         observed TOKEN_FETCH_FAILED/DNS_RECORD_FAILED, since we don't
--         know which sub-step actually failed for pre-migration rows;
--         a reconciliation pass, §7, will resolve it to a specific code
--         the next time it runs)
--   tunnelId IS NULL
--       → PENDING

-- Client.isInstalled, for every existing row:
--   set true where the client's AgentSession.lastConnectedAt IS NOT NULL

-- provisioning_operations: NOT backfilled historically — this table only
-- starts recording from the moment this migration ships. Existing clients
-- simply have no ProvisioningOperation history before this date, which is
-- fine: ProvisioningOperation is about auditing/recovering NEW attempts,
-- not about reconstructing history that was never captured.
```

No column is removed; DTOs gain fields additively (§21).

---

## 21. API/OpenAPI impact — **PROPOSED**

- `ProvisionResultDto`: add `provisioningState`, `operationId` (additive).
- `AgentSessionViewDto`: add `provisioningState`, `templateDeliveryStatus`.
  (v2.1 also proposed `provisioningFailedAt`/`provisioningFailureReason`
  here; removed in v2.2 per §8 — that data lives on `ProvisioningOperation`,
  not `AgentSession`, and is not surfaced on this DTO in this phase.)
- Server-facing view DTOs: add `cloudflareProvisioningStatus`,
  `cloudflareFailureCode` additively.
- New endpoint (proposed): `POST /provisioning/:clientId/retry` (ADMIN-only,
  throttled) — internally just another call into `startOrResume()` (§5.5).
  If invoked with the failed operation's own `Idempotency-Key`, it reopens
  that same operation (§5.4, §6.4); otherwise it starts a fresh
  `ProvisioningOperation`. Either way, execution resumes from the prior
  attempt's `lastCompletedStep`.
- `POST /provisioning/client` gains an optional `Idempotency-Key` header.
- `provisioning_events` / `provisioning_operations` tables are internal — no
  new read endpoint proposed for either in this phase.

---

## 22. E2E acceptance matrix — **PROPOSED**

- **§6.3's crash-recovery scenario, verbatim** — same `Idempotency-Key`,
  same payload, forced crash after Server+Cloudflare tunnel creation
  (`lastCompletedStep = RECONCILE_CLOUDFLARE`) but before operation
  completion → retry resumes at `ENSURE_AGENT_SESSION`, zero duplicate
  Client/Server/tunnel. Additionally assert: no `AgentSession` row and no
  `ProvisioningState` exists for the client until this retry completes
  `ENSURE_AGENT_SESSION` — the crash point genuinely has none, not an
  implicit/default one.
- Same `Idempotency-Key`, **different** payload → 409 Conflict, zero side
  effects.
- Two **concurrent** requests with the same `Idempotency-Key` (true race) →
  exactly one proceeds, the other observes the existing row via the unique
  index (§5.4) — distinct from the sequential-retry case above.
- **Two requests with NO `Idempotency-Key`, same `(clientId, subdomain)`**
  → exactly 2 `ProvisioningOperation` rows, exactly 1 `Server` row — the
  second operation's `ENSURE_SERVER` step resolves to the existing Server
  via §4.1 rather than creating a duplicate.
- `existingClientId` + new `subdomain` → new Server created (multi-server
  case explicitly preserved).
- `existingClientId` + a `subdomain` that already exists for that client →
  no duplicate Server, resolves to the existing one, never a raw 500.
- **A `ProvisioningOperation` fails during `ENSURE_SERVER` (simulated
  `SUBDOMAIN_TAKEN` race)** → `ProvisioningOperation.status = FAILED`,
  `failureCode = SUBDOMAIN_TAKEN`; no `AgentSession` row created; a
  Diagnostics `provisioning` check for that client reports `hasSession:
  false` (`NOT_PROVISIONED`/`UNKNOWN`), the same as if provisioning had
  never been attempted — confirms §3.1's central fix: a failed operation
  never leaves a dangling or half-initialized `ProvisioningState`.
- **A `ProvisioningOperation` retried with the same `Idempotency-Key` after
  `FAILED`** → the same `operationId` is reused (`FAILED → IN_PROGRESS`),
  never a second row for that key; a direct regression test against the
  v2.2→v2.3 fix, asserting the row count for that `(principalUserId,
  idempotencyKey)` pair stays at 1 across the whole failed→retried→succeeded
  sequence.
- **A `FAILED` operation retried with the same `Idempotency-Key` but a
  DIFFERENT payload** → `409 Conflict`; the row's `status` remains `FAILED`
  and its `request_fingerprint` is unchanged from the original — assert
  directly against the database row, not just the HTTP response, that no
  mutation occurred. This is the regression test for the v2.3→v2.4 fix: a
  naive `WHERE status = 'FAILED'` guard (without the fingerprint condition)
  would incorrectly flip this row to `IN_PROGRESS`.
- **Consent recorded, then the install token expires before the agent ever
  connects, then `provision` is retried** — `AgentSession` moves
  `AWAITING_INSTALL → INSTALL_CONSENTED → INSTALL_EXPIRED`, then the retry
  must land back on `INSTALL_CONSENTED` (not `AWAITING_INSTALL`), with a
  freshly-minted `installToken` and `serviceStartConsentAt` byte-for-byte
  unchanged from its original value — the direct regression test for the
  second v2.3 fix.
- A `ProvisioningOperation` reaches `SUCCEEDED` while `AgentSession.provisioningState`
  is still `AWAITING_INSTALL` — confirms §5.6's completion boundary is
  actually implemented as specified, not conflated with `READY`.
- `READY` client, repeat `POST /provisioning/client` with the same key →
  `agentToken` unchanged, no `reconnect_required` sent to the live agent
  socket.
- `POST /tinta-core/provision/:clientId` on a `READY` client → still rotates
  and disconnects as today.
- `READY` client whose agent then disconnects → `ProvisioningState` remains
  `READY`, `AgentStatus` correctly shows `DISCONNECTED` (§3.1's monotonicity
  rule, tested directly).
- The `READY` transition's atomic write (§3.2.2): simulated crash between
  `AgentSession.provisioningState = READY` write and a subsequent unrelated
  telemetry write confirms `isInstalled` and `provisioningState` are never
  observed in a desynced state.
- Cloudflare Case A/B/C (§7), each as its own test, including Case B's
  deterministic tunnel-name lookup specifically (create a tunnel, delete its
  `tunnelId`/`tunnelToken` from the DB directly to simulate the lost write,
  confirm recovery finds and reconciles the same tunnel rather than creating
  a new one).
- Backend restart with a `CONNECTED` `AgentSession` and a genuinely-dead
  agent → status reflects `DISCONNECTED` within the reconciliation window.
- `isInstalled` becomes `true` exactly at the `→ READY` transition, stays
  `true` through a subsequent `agentToken` rotation and a disconnect/reconnect
  cycle.
- `templateDeliveryStatus` never contains `APPLIED` anywhere in this phase's
  test suite — explicit assertion that the value is structurally
  unreachable without the ACK protocol, not just untested.
- Template application: forced "unexpected" failure produces a
  `TEMPLATE_UNEXPECTED` `provisioning_events` row; `ProvisioningState`
  reaches `READY` regardless.
- `provisioning_events` rows never contain secrets — regression-tested like
  Diagnostics' `assertNoForbiddenKeys`.
- `Diagnostics` §19 (only if a refactor is approved): `checkProvisioning`'s
  output for `AWAITING_INSTALL`/`INSTALL_CONSENTED`/`INSTALL_EXPIRED`/`READY`
  matches exactly whether it re-derives from raw fields or reads the new
  `provisioningState` column directly — a consistency test, not a new-branch
  test (§19's v2.2 update).

---

## 23. Out of scope (explicit)

- Concurrent WebSocket registration for one `clientId` — P2.3.
- Home Assistant discovery/pairing in the backend — Agent-repo responsibility.
- Full Agent-repo implementation of the template-apply-ack protocol —
  contract designed, not built.
- D1 (`GET /install/:token` exposure/authorization model).
- D2 (SUPPORT access scoping).
- Customer 360.
- Ticket linkage.
- A dedicated `provisioning_events`/`provisioning_operations` browser/admin UI.
- Diagnostics' `checkProvisioning` refactor (§19) — proposed, not scheduled.

---

## Sequencing

1. Migration (§20): new columns/tables, backfill.
2. `ProvisioningOperation` + atomic idempotency claim (§5, §6.1) —
   infrastructure, no `ProvisioningState` behavior change yet. This step
   alone covers all pre-`AgentSession` progress (`RESOLVE_CLIENT` through
   `ENSURE_AGENT_SESSION`) — there is no separate "CREATED/PROVISIONING_SERVER
   state machine" step, per §3.1's v2.2 fix.
3. `ProvisioningState` writes (§3/§4) wired into `startOrResume()`/
   `handleRegister()`, including the `READY`-no-longer-destructively-rotated
   fix, the formal `READY` definition + atomic write (§3.2, §3.2.2), and the
   `(clientId, subdomain)` resource-identity rule (§4.1). This step begins
   at `AgentSession` creation, not before.
4. Resource/Health evidence (§3.3) + Cloudflare case A/B/C reconciliation
   (§7, including the deterministic Case B lookup) + startup reconciliation
   (§14).
5. Template failure classification (§12's FIX half only) +
   `templateDeliveryStatus` (§3.2.1, `SENT`/`PENDING`/`FAILED` only).
6. `isInstalled` derived-projection binding (§13).
7. API/OpenAPI additive changes (§21) + contract test.
8. Diagnostics compatibility review (§19) — a decision point, not an
   implementation step.
9. Full e2e acceptance pass (§22), including §6.3's crash-recovery scenario,
   the concurrent-race test, the no-key double-submit test, and the
   failed-operation-leaves-no-dangling-state test, in an isolated worktree.

Each step above is intended to land as its own atomic, individually-verified
commit.
